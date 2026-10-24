# Personal tasks

Measurements for the beyond-GitHub work that cannot be taken from the machine where the rest was done: the engine is blocked on that network, or the measurement needs a personal account. Each task says what to run, what to record, and where the answer goes. Results go back into [`tool-surface.md`](tool-surface.md); tick the task here when they have.

Nothing in this file is a decision. Every task feeds one.

## grep.app

Unreachable from the corporate network, so its column in the code-search capability matrix is partly `?`.

- [ ] **Result ceiling.** Search a very common term, such as `useState(`, and page until results stop. Record the largest result count the API will return, and whether it reports a total larger than that.
- [ ] **Completeness signal.** Check the response for anything that says a search was cut short — a flag, a partial marker, a total that exceeds what was returned. Record "none" if there is none; that is a finding.
- [ ] **Rate limit.** Note the response headers, and run calls back to back until one is refused, if one is.
- [ ] **Results per call.** The librarian reaches grep.app through its MCP server's `searchGitHub` tool. Record how many hits one call returns, and whether any argument raises it — that number is `search_code_grepapp`'s `limit` ceiling, since the tool does not paginate.

Answers go in the `_grepapp` column of the matrix under _The `search_code_*` family_.

## gitlab.com advanced search

Decides whether the built-in `gitlab.com` source sets `advancedSearch: true`. Needs a personal gitlab.com access token with `read_api`.

- [ ] **Global blob search.** `GET https://gitlab.com/api/v4/search?scope=blobs&search=defineConfig`. A 200 with results means global code search works for an ordinary account; a 400 naming advanced search or exact code search means it does not.
- [ ] **Group-scoped blob search** on a large public group, via `GET /groups/:id/search?scope=blobs&search=…`. Record whether it differs from global.
- [ ] **Filter syntax.** If global search works, try `defineConfig filename:*.ts` and `defineConfig path:src/` and record whether each narrows results or is ignored.
- [ ] **Pattern semantics.** A substring of an identifier, a quoted phrase, and a `/regex/`, the way GitHub's were measured in _`search_code_github`_.

Answers go under _`search_code_gitlab`_, and set the built-in default in _Source values, concretely_.

## Firecrawl Developer Index

Blocked on the corporate network at the proxy, and to be used on personal machines only. The open question is placement — see _Firecrawl's Developer Index is not code search_ — and these answers settle it.

- [ ] **What a result looks like.** Run three real research questions through `GET https://api.firecrawl.dev/v2/search/developer?query=…&k=10`: a library behaviour question, an error message, and "was this bug fixed". Save the raw responses. Record the result shape, how long passages are, and whether `title` is often missing as the docs warn.
- [ ] **Against `web_search`.** Ask the same three questions through `web_search`. Record which answered each one better, and why — primary source, fresher, fewer irrelevant hits.
- [ ] **Against GitHub issue search.** For the "was this bug fixed" question, run GitHub's issue and pull-request search on the same repository. If it answers as well, that is the cheaper path, and Firecrawl's case rests on READMEs and documentation.
- [ ] **Repository filters against `search_repos_github`.** The index filters on `language`, `topic`, `min_stars`, and others. Run one repository-discovery question both ways and record whether Firecrawl's repository half agrees with GitHub's.
- [ ] **Limits.** The largest `k` accepted, the keyless rate limit, and what changes with an API key.
- [ ] **Scope echo.** Scope a search with `repos` to one indexed and one unindexed repository, and confirm the response's `indexed` flag tells them apart — the docs say it does, and it is the completeness signal this engine would have.

Answers go under _Firecrawl's Developer Index is not code search_.
