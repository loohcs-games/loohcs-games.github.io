// 自動公開の中身。Pull Request が「自分のゲームだけを直したもの」かを確かめ、よければ取り込む。
// Pull Request 側のコードは実行しない。API で読むだけ（games.js は文法を調べるだけで、動かさない）。
const vm = require('node:vm');

const SITE = 'https://loohcs-games.github.io/';
const MARK = '<!-- auto-publish -->';
const TEXT = /\.(html?|js|mjs|css|json|md|txt|svg)$/i;

// その人のフォルダ名か。ユーザー名を小文字にしたもの、または 小文字のユーザー名-数字
function ownDir(dir, login) {
  const l = login.toLowerCase();
  return dir === l || (dir.startsWith(l + '-') && /^[0-9]+$/.test(dir.slice(l.length + 1)));
}

// files: [{ filename, status, previous_filename, patch }]
// getText(path): Pull Request 側のファイルの中身（無ければ null）
// 戻り値: { problems: [文], dirs: [直したフォルダ名] }
async function check({ login, skipOwner, files, getText }) {
  const problems = [], dirs = new Set();
  const l = login.toLowerCase();
  if (!files.length) problems.push('変更されたファイルがありません。');
  for (const f of files) {
    for (const name of [f.filename, f.previous_filename].filter(Boolean)) {
      if (name === 'games.js') continue;
      const m = /^games\/([^/]+)\/.+/.exec(name);
      if (!m) { if (!skipOwner) problems.push(`\`${name}\` は自動公開の対象外です（対象は \`games/${l}/\` の中と \`games.js\` の自分の行）。`); continue; }
      if (!/^[a-z0-9-]+$/.test(m[1])) problems.push(`フォルダ名 \`${m[1]}\` に使えない文字があります（小文字の英数字とハイフンだけ）。`);
      else if (!skipOwner && !ownDir(m[1], login)) problems.push(`\`games/${m[1]}/\` は自分のフォルダではありません（自分のフォルダは \`games/${l}/\`、2本目からは \`games/${l}-2/\`）。`);
      if (name === f.filename && f.status !== 'removed') dirs.add(m[1]);
    }
  }

  // 置いたゲームの index.html
  for (const f of files) {
    if (f.status === 'removed') continue;
    if (/^games\/[^/]+\/index\.html$/.test(f.filename)) {
      const t = await getText(f.filename);
      if (t == null) problems.push(`\`${f.filename}\` が読めませんでした。`);
      else if (!/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(t)) problems.push(`\`${f.filename}\` の \`<head>\` に \`<meta name="robots" content="noindex, nofollow">\` がありません。`);
    }
    if (TEXT.test(f.filename) && f.filename !== 'games.js') {
      const t = await getText(f.filename);
      const m = t && /(\/Users\/[^/\s"'<>]+\/|\/home\/[^/\s"'<>]+\/|[A-Za-z]:\\+Users\\+[^\\\s"'<>]+)/.exec(t);
      if (m) problems.push(`\`${f.filename}\` に PC のフォルダ名らしいもの（\`${m[1]}\`）が入っています。消してください。`);
    }
  }
  for (const d of dirs) {
    if ((await getText(`games/${d}/index.html`)) == null) problems.push(`\`games/${d}/index.html\` がありません。ゲームの入口は \`index.html\` という名前にします。`);
  }

  // games.js
  const g = files.find(f => f.filename === 'games.js');
  if (g) {
    if (g.status !== 'modified') problems.push('`games.js` は消したり名前を変えたりしません。');
    else {
      const src = await getText('games.js');
      try { new vm.Script(src, { filename: 'games.js' }); }
      catch (e) { problems.push(`\`games.js\` に書き間違いがあります（${e.message}）。カンマ・引用符・波かっこを見てください。`); }
      if (!skipOwner) {
        if (!g.patch) problems.push('`games.js` の変更が大きすぎて確かめられません。');
        else for (const line of g.patch.split('\n')) {
          if (!/^[+-]/.test(line) || /^(\+\+\+|---) /.test(line)) continue;
          const body = line.slice(1).trim();
          if (!body) continue;
          const id = /^\{\s*id:\s*"([^"]*)"/.exec(body);
          const ok = id ? ownDir(id[1], login)
            : body.startsWith('//') && body.toLowerCase().includes(l);
          if (!ok) { problems.push(`\`games.js\` で自分の枠ではない行が変わっています：\`${body.slice(0, 80)}\``); continue; }
          if (id && line[0] === '+' && (await getText(`games/${id[1]}/index.html`)) == null)
            problems.push(`\`games.js\` に \`${id[1]}\` を書いていますが、\`games/${id[1]}/index.html\` がありません。`);
        }
      }
    }
  }
  return { problems: [...new Set(problems)], dirs: [...dirs].sort() };
}

async function run({ github, context, core, prNumber, dryRun }) {
  const { owner, repo } = context.repo;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: prNumber });
  const login = pr.user.login, sha = pr.head.sha;
  const manual = context.eventName === 'workflow_dispatch';
  if (pr.state !== 'open') return core.info('開いていない Pull Request。何もしない');
  if (pr.draft) return core.info('下書き。何もしない');
  if (pr.base.ref !== 'main') return core.info('main 向けではない。何もしない');
  if (pr.head.repo?.full_name !== `${owner}/${repo}`) return core.info('フォークから。何もしない');
  const { data: perm } = await github.rest.repos.getCollaboratorPermissionLevel({ owner, repo, username: login });
  const admin = perm.permission === 'admin';
  if (!['admin', 'write'].includes(perm.permission)) return core.info('書き込み権限のない人から。何もしない');
  // 管理者（講師）の Pull Request は、手で実行したときだけ扱う。そのときは「自分のフォルダか」を問わない
  if (admin && !manual) return core.info('管理者の Pull Request。自動では取り込まない');

  const files = await github.paginate(github.rest.pulls.listFiles, { owner, repo, pull_number: prNumber, per_page: 100 });
  const cache = new Map();
  const getText = async path => {
    if (!cache.has(path)) cache.set(path, github.rest.repos.getContent({ owner, repo, path, ref: sha, mediaType: { format: 'raw' } })
      .then(r => (typeof r.data === 'string' ? r.data : null), e => { if (e.status === 404) return null; throw e; }));
    return cache.get(path);
  };
  const { problems, dirs } = await check({ login, skipOwner: admin, files, getText });
  core.info(`PR #${prNumber} by ${login} (${sha.slice(0, 7)}) files=${files.length} dirs=${dirs.join(',')} problems=${problems.length}`);
  problems.forEach(p => core.info('- ' + p));

  const say = async body => {
    if (dryRun) return core.info('[dry run] コメント:\n' + body);
    const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: prNumber, per_page: 100 });
    const old = comments.find(c => c.user.type === 'Bot' && c.body.includes(MARK));
    if (old) await github.rest.issues.updateComment({ owner, repo, comment_id: old.id, body: MARK + '\n' + body });
    else await github.rest.issues.createComment({ owner, repo, issue_number: prNumber, body: MARK + '\n' + body });
  };

  if (problems.length) {
    await say(`**自動では公開しませんでした。** 次を直して、同じブランチにもう一度送ると、確かめ直します。\n\n${problems.map(p => '- ' + p).join('\n')}\n\n直し方が分からないとき、他の人のフォルダも直したいときは、先生に声をかけてください（先生が手で取り込めます）。`);
    return core.notice('確認で止まった。取り込まない');
  }
  if (dryRun) return core.notice('[dry run] 確認は全部通った。取り込みはしない');

  // 取り込む。確かめたコミット（sha）のままであるときだけ
  let merged = false, why = '';
  for (let i = 0; i < 6 && !merged; i++) {
    try {
      await github.rest.pulls.merge({ owner, repo, pull_number: prNumber, sha, merge_method: 'merge' });
      merged = true;
    } catch (e) {
      why = e.message;
      if (e.status === 409) return core.notice('確かめている間に新しいコミットが来た。次の実行に任せる');
      if (e.status !== 405) throw e;
      await sleep(5000); // 取り込めるかの計算待ち、または他の人とほぼ同時
    }
  }
  if (!merged) {
    await say(`**自動では公開しませんでした。** 確認は通りましたが、取り込めませんでした（${why}）。\n\nたいてい、\`games.js\` で他の人の変更とぶつかっています。main の最新を自分のブランチに取り込んで（AI に「main の最新を取り込んで、もう一度送って」と頼む）、もう一度送ってください。`);
    return core.notice('取り込めなかった: ' + why);
  }
  try { await github.rest.git.deleteRef({ owner, repo, ref: 'heads/' + pr.head.ref }); } catch (e) { core.info('ブランチは消せなかった: ' + e.message); }
  // 念のため、公開ページの作り直しを頼む（Actions からの取り込みでは始まらないことがあるため）
  try { await github.request('POST /repos/{owner}/{repo}/pages/builds', { owner, repo }); } catch (e) { core.info('Pages のビルド依頼は失敗: ' + e.message); }
  const urls = dirs.map(d => `- ${SITE}games/${d}/`).join('\n');
  await say(`**公開しました。** 数分で反映されます（10分ほどかかることもあります）。\n\n- 一覧：${SITE}\n${urls}`);
  core.notice('取り込んだ');
}

module.exports = { run, check, ownDir };
