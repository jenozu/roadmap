import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchProject,
  GitHubProjectError
} from "../src/lib/github-server.ts";

const MARKDOWN = [
  "# Private project",
  "# Phase 0 — Foundation",
  "## Goal",
  "Securely load the roadmap.",
  "- [x] Configure reader",
  "- [ ] Verify deployment"
].join("\n");

function filePayload(markdown = MARKDOWN) {
  return {
    type: "file",
    encoding: "base64",
    size: Buffer.byteLength(markdown),
    content: Buffer.from(markdown, "utf8").toString("base64")
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function mockGitHub(handler) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    const auth = new Headers(init.headers).get("Authorization");
    calls.push({ url, auth });
    return handler({ url, auth, calls });
  };
  return { fetchImpl, calls };
}

const project = { repo: "jenozu/yuzimiONLINE", branch: "main", path: "master_plan.md", name: "Yuzimi" };
const token = "github_pat_TEST_SECRET_NEVER_RETURN";

test("existing public repositories load without any credential", async () => {
  const mock = mockGitHub(({ url, auth }) => {
    assert.equal(auth, null);
    if (url.startsWith("https://raw.githubusercontent.com/")) return new Response(MARKDOWN, { status: 200 });
    if (url.includes("/commits?")) return json([]);
    throw new Error("unexpected " + url);
  });
  const result = await fetchProject(
    { repo: "jenozu/trade-alerts", branch: "main", path: "phases.md" },
    { fetchImpl: mock.fetchImpl, env: {} }
  );
  assert.equal(result.repositoryVisibility, "public");
  assert.equal(result.voyage.islands.length, 1);
  assert.equal(result.voyage.taskCount, 2);
  assert.ok(mock.calls.every(call => call.auth === null));
});

test("allowlisted private repository uses authenticated Contents and commit requests only after public lookup fails", async () => {
  const mock = mockGitHub(({ url, auth }) => {
    if (url.startsWith("https://raw.githubusercontent.com/") && !auth) return new Response("Not Found", { status: 404 });
    if (url.endsWith("/repos/jenozu/yuzimiONLINE") && !auth) return json({ message: "Not Found" }, 404);
    assert.equal(auth, "Bearer " + token);
    if (url.endsWith("/repos/jenozu/yuzimiONLINE")) return json({ private: true });
    if (url.includes("/contents/")) return json(filePayload());
    if (url.includes("/commits?")) return json([{
      sha: "abc123",
      html_url: "https://github.com/jenozu/yuzimiONLINE/commit/abc123",
      commit: { message: "Update roadmap\nmore", author: { name: "Andel", date: "2026-10-05T12:00:00Z" } }
    }]);
    throw new Error("unexpected " + url);
  });
  const result = await fetchProject(project, {
    fetchImpl: mock.fetchImpl,
    env: {
      GITHUB_READ_TOKEN: token,
      GITHUB_PRIVATE_REPO_ALLOWLIST: "jenozu/yuzimiONLINE"
    },
    privateAccessAuthorized: true
  });
  assert.equal(result.repositoryVisibility, "private");
  assert.equal(result.voyage.progress, 50);
  assert.equal(result.activity.length, 1);
  assert.equal(result.activity[0].message, "Update roadmap");
  const authenticated = mock.calls.filter(call => call.auth);
  assert.ok(authenticated.length >= 3);
  assert.ok(authenticated.every(call => call.url.includes("/repos/jenozu/yuzimiONLINE")));
});

test("private and public Markdown go through the same parser", async () => {
  const publicMock = mockGitHub(({ url }) => url.startsWith("https://raw.githubusercontent.com/") ? new Response(MARKDOWN, { status: 200 }) : json([]));
  const privateMock = mockGitHub(({ url, auth }) => {
    if (!auth && url.startsWith("https://raw.githubusercontent.com/")) return new Response("Not Found", { status: 404 });
    if (!auth) return json({}, 404);
    if (url.includes("/contents/")) return json(filePayload());
    if (url.includes("/commits?")) return json([]);
    return json({ private: true });
  });
  const publicResult = await fetchProject(
    { repo: "jenozu/example", branch: "main", path: "master_plan.md" },
    { fetchImpl: publicMock.fetchImpl, env: {}, includeActivity: false }
  );
  const privateResult = await fetchProject(project, {
    fetchImpl: privateMock.fetchImpl,
    env: { GITHUB_READ_TOKEN: token, GITHUB_PRIVATE_REPO_ALLOWLIST: "JENOZU/YUZIMIONLINE" },
    privateAccessAuthorized: true,
    includeActivity: false
  });
  assert.deepEqual(privateResult.voyage, publicResult.voyage);
});

test("non-allowlisted private repository is rejected before token use", async () => {
  const mock = mockGitHub(({ url, auth }) => {
    assert.equal(auth, null, "credential must never be used for a non-allowlisted repository");
    return url.startsWith("https://raw.githubusercontent.com/")
      ? new Response("Not Found", { status: 404 })
      : json({ message: "Not Found" }, 404);
  });
  await assert.rejects(
    fetchProject(project, {
      fetchImpl: mock.fetchImpl,
      env: { GITHUB_READ_TOKEN: token, GITHUB_PRIVATE_REPO_ALLOWLIST: "jenozu/other-private" },
      privateAccessAuthorized: true
    }),
    error => error instanceof GitHubProjectError && error.code === "PRIVATE_REPO_NOT_AUTHORIZED" && error.status === 403
  );
});

test("allowlisted private repository requires the Voyages private session before token use", async () => {
  const mock = mockGitHub(({ url, auth }) => {
    assert.equal(auth, null);
    return url.startsWith("https://raw.githubusercontent.com/")
      ? new Response("Not Found", { status: 404 })
      : json({ message: "Not Found" }, 404);
  });
  await assert.rejects(
    fetchProject(project, {
      fetchImpl: mock.fetchImpl,
      env: { GITHUB_READ_TOKEN: token, GITHUB_PRIVATE_REPO_ALLOWLIST: project.repo }
    }),
    error => error instanceof GitHubProjectError && error.code === "PRIVATE_SESSION_REQUIRED"
  );
});

test("missing GITHUB_READ_TOKEN returns a controlled configuration error", async () => {
  const mock = mockGitHub(({ url }) => url.startsWith("https://raw.githubusercontent.com/")
    ? new Response("Not Found", { status: 404 })
    : json({ message: "Not Found" }, 404));
  await assert.rejects(
    fetchProject(project, {
      fetchImpl: mock.fetchImpl,
      env: { GITHUB_PRIVATE_REPO_ALLOWLIST: project.repo },
      privateAccessAuthorized: true
    }),
    error => error instanceof GitHubProjectError && error.code === "GITHUB_CREDENTIAL_NOT_CONFIGURED" && error.status === 503
  );
});

test("public repository with missing roadmap reports file not found", async () => {
  const mock = mockGitHub(({ url }) => {
    if (url.startsWith("https://raw.githubusercontent.com/")) return new Response("Not Found", { status: 404 });
    return json({ private: false }, 200);
  });
  await assert.rejects(
    fetchProject({ repo: "jenozu/public", branch: "main", path: "missing.md" }, { fetchImpl: mock.fetchImpl, env: {} }),
    error => error instanceof GitHubProjectError && error.code === "FILE_NOT_FOUND"
  );
});

for (const [status, code] of [[401, "GITHUB_CREDENTIAL_INVALID"], [403, "PRIVATE_REPO_ACCESS_DENIED"], [404, "REPOSITORY_UNAVAILABLE"]]) {
  test("authenticated repository metadata handles GitHub " + status + " safely", async () => {
    const mock = mockGitHub(({ url, auth }) => {
      if (!auth && url.startsWith("https://raw.githubusercontent.com/")) return new Response("Not Found", { status: 404 });
      if (!auth) return json({}, 404);
      return json({ message: "sensitive upstream text " + token }, status);
    });
    let caught;
    try {
      await fetchProject(project, {
        fetchImpl: mock.fetchImpl,
        env: { GITHUB_READ_TOKEN: token, GITHUB_PRIVATE_REPO_ALLOWLIST: project.repo },
        privateAccessAuthorized: true
      });
    } catch (error) { caught = error; }
    assert.ok(caught instanceof GitHubProjectError);
    assert.equal(caught.code, code);
    assert.doesNotMatch(caught.message, /github_pat_TEST_SECRET_NEVER_RETURN/);
    assert.doesNotMatch(JSON.stringify({ error: caught.message, code: caught.code }), /github_pat_TEST_SECRET_NEVER_RETURN/);
  });
}

test("authenticated 404 after repository verification is a file-not-found error", async () => {
  const mock = mockGitHub(({ url, auth }) => {
    if (!auth && url.startsWith("https://raw.githubusercontent.com/")) return new Response("Not Found", { status: 404 });
    if (!auth) return json({}, 404);
    if (url.endsWith("/repos/jenozu/yuzimiONLINE")) return json({ private: true });
    return json({}, 404);
  });
  await assert.rejects(
    fetchProject(project, {
      fetchImpl: mock.fetchImpl,
      env: { GITHUB_READ_TOKEN: token, GITHUB_PRIVATE_REPO_ALLOWLIST: project.repo },
      privateAccessAuthorized: true
    }),
    error => error instanceof GitHubProjectError && error.code === "FILE_NOT_FOUND"
  );
});

test("invalid repo branch and path input is rejected before any request", async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return json({}); };
  for (const invalid of [
    { repo: "https://github.com/jenozu/x", branch: "main", path: "a.md" },
    { repo: "jenozu/x", branch: "../secret", path: "a.md" },
    { repo: "jenozu/x", branch: "main", path: "../secret.md" }
  ]) {
    await assert.rejects(
      fetchProject(invalid, { fetchImpl, env: {} }),
      error => error instanceof GitHubProjectError && error.code === "INVALID_PROJECT"
    );
  }
  assert.equal(called, false);
});

test("preferred private polling never performs an unauthenticated repository probe", async () => {
  const mock = mockGitHub(({ url, auth }) => {
    assert.equal(auth, "Bearer " + token);
    if (url.includes("/contents/")) return json(filePayload());
    if (url.includes("/commits?")) return json([]);
    throw new Error("unexpected " + url);
  });
  const result=await fetchProject(project,{
    fetchImpl:mock.fetchImpl,
    env:{GITHUB_READ_TOKEN:token,GITHUB_PRIVATE_REPO_ALLOWLIST:project.repo},
    privateAccessAuthorized:true,
    preferPrivate:true,
    includeActivity:false
  });
  assert.equal(result.repositoryVisibility,"private");
  assert.ok(mock.calls.every(call=>call.auth==="Bearer "+token));
});
