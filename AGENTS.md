# n8n community node

## Overview
This is a project containing code for an n8n community node. n8n is a workflow
automation platform where users build workflows with nodes, which are the
building block of a workflow. Nodes can perform a range of actions, such as
starting a workflow (called a "trigger node"), fetching and sending data, or
processing and manipulating it. Besides that there are credentials - entities
that store sensitive information on how to connect to external services and
APIs. A node can require some credentials to be used. Community nodes are a way
for anyone to create such nodes and add them to be used in n8n. All community
nodes are named in a format: `n8n-nodes-<n>` or `@org/n8n-nodes-<n>`.
Community nodes can also be submitted for approval to be used on n8n Cloud
version. In that case there are rules that the node needs to follow in order to
be approved

## Important notes
- Follow the **rules and guidelines in this document and the linked docs
  below** over any code examples.
- All code blocks in these docs are **illustrative and incomplete**.
  They **MUST NOT** be copied verbatim or assumed to be the final desired code.
- Replace example names like `Example`, `Wordpress`, `wordpressApi`, etc.
  with names that match the **actual service / node** you are building.
- When in doubt, **generalize from the patterns**, don't replicate the exact
  structure, fields, or values from the examples.
- Produce the **full implementation** needed for the current project
  (nodes, credentials, tests, etc.), not just fragments similar to examples.
- If an example omits parts (e.g. types, operations, properties), **infer and
  implement the missing parts** based on the real requirements / API docs.
- Never output `Wordpress`-specific code unless the project is actually about
  WordPress.

## Project structure
There are two main folders in this project:
- `nodes` contains all of the nodes in a package (there can be more than 1).
  The code for each node usually lives in its own folder
- `credentials` contains all of the credentials in a package. Usually it's just
  a single file for every credential
So it looks something like this:
.
├── nodes/
│   └── Example/
│       ├── Example.node.ts
│       └── ...
├── credentials/
│   └── Example.credentials.ts
├── package.json
└── ...
It's important to note that `package.json` has a special field `n8n` that have
information about nodes and credentials in a package:
```json
{
  "name": "n8n-nodes-example",
  "version": "1.0.0",
  "n8n": {
    "n8nNodesApiVersion": 1,
    "strict": true,
    "credentials": [
        "dist/credentials/Example.credentials.js"
    ],
    "nodes": [
      "dist/nodes/Example/Example.node.js"
    ]
  }
}
```
`nodes` and `credentials` keys contain paths to transpiled JS files in a `dist`
folder for the nodes and credentials respectively. If you add/remove/rename
nodes and/or credentials, you need to make sure to update `n8n.nodes` and
`n8n.credentials` keys in `package.json` accordingly. Initial files in the
project _may_ contain example nodes and/or credentials that need to be
**removed or renamed** once you start making an actual node.

## Key guidelines
- Use the `n8n-node` CLI tool **whenever possible** for building, dev mode,
  linting, etc.
- **Always** address any lint/typecheck errors/warnings, unless there is a
  **very specific reason** to ignore/disable it
- Make sure to use **proper types whenever possible**
- If you are updating the npm package version, make sure to **update
  CHANGELOG.md** in the root of the repository
- Read `.agents/workflow.md` for more info

## Context-specific docs
Load these before working on the relevant area:

| Working on...                        | Read first                                                          |
|--------------------------------------|---------------------------------------------------------------------|
| Any node file in `nodes/`            | `.agents/nodes.md` and `.agents/properties.md`                      |
| A declarative-style node             | above + `.agents/nodes-declarative.md`                              |
| A programmatic-style node            | above + `.agents/nodes-programmatic.md`                             |
| Files in `credentials/`              | `.agents/credentials.md`                                            |
| Adding a new version to a node       | `.agents/versioning.md`                                             |
| Starting a new task or planning      | `.agents/workflow.md`                                               |

## Additional resources
If you need any extra information, here are links to n8n's official docs
regarding building community nodes:
- https://docs.n8n.io/integrations/community-nodes/build-community-nodes/
- https://docs.n8n.io/integrations/creating-nodes/overview/
- https://docs.n8n.io/integrations/creating-nodes/build/reference/
- https://docs.n8n.io/integrations/creating-nodes/build/reference/ux-guidelines/


## APIM LLM Gateway Requirements

### Objective
Build a standalone n8n Azure OpenAI Chat Model sub-node that connects through an Azure API Management (APIM) LLM gateway using delegated Microsoft Entra authentication.

### Naming and Configuration
- Use organization-neutral names throughout code, documentation, examples, and UI labels.
- Suggested display name: `Azure OpenAI Chat Model (APIM Gateway)`.
- Suggested node name: `lmChatAzureOpenAiApimGateway`.
- Suggested credential name: `apimGatewayEntraOAuth2Api`.
- Do not hard-code organization names, tenant IDs, client IDs, gateway hostnames, API audiences, or deployment names.
- Treat tenant, gateway endpoint, API scope, deployment, and API version as configurable values.
- Use placeholders in documentation; never invent production configuration.

### Packaging and Upstream Compatibility
- Use the existing standalone node package generated by the official n8n scaffolding tool.
- Do not fork the entire n8n repository.
- Follow the scaffold's build, lint, testing, and package-registration conventions.
- Pin and document the target n8n release.
- Inspect that release's Azure OpenAI Chat Model implementation before copying or adapting it.
- Preserve the AI sub-node connection metadata and `supplyData()` behavior.
- Explicitly manage compatible LangChain dependencies.
- Avoid importing private n8n monorepo utilities that are unavailable to standalone packages.
- Leave the official Azure OpenAI node unchanged.

### Delegated Authentication
- Define a custom credential extending n8n's OAuth2 credential functionality.
- Use Microsoft Entra Authorization Code flow, not client credentials.
- Request the configured delegated gateway scope and `offline_access` for refresh support.
- Use the callback URL displayed by n8n and document its Entra registration requirements.
- Store secrets and OAuth tokens only through n8n's credential system.
- Follow OAuth conventions supported by the pinned n8n release.

### Token Refresh: Option B
- First validate an authenticated request to a lightweight APIM probe endpoint using n8n's `httpRequestWithAuthentication` helper.
- Verify the helper is available in the AI sub-node's execution context.
- Verify an expired access token triggers refresh and persists the updated OAuth token data.
- Verify the node can retrieve the updated access token after that request.
- Only after these checks pass, provide the delegated token to LangChain through `azureADTokenProvider`.
- Do not assume credential reads are refreshed or that every authentication failure triggers token refresh.
- Document the probe's required response behavior and test it against the pinned n8n release.
- If this approach is unsupported or unreliable, stop and report the limitation before changing the authentication design.
- Never fall back silently to an app-only token.

### Gateway and Security
- Send inference requests to the configured APIM gateway, not directly to Azure OpenAI.
- APIM must validate token issuer, audience, lifetime, and the required delegated scope.
- Reject app-only tokens on the delegated route.
- Keep backend Azure OpenAI authentication within APIM.
- Restrict credential-bearing requests, including probes and discovery calls, to approved HTTPS gateway endpoints.
- Do not forward bearer tokens to untrusted hosts or across unvalidated redirects.
- Never log or expose access tokens, refresh tokens, client secrets, or authorization headers.

### Identity Attribution
- Usage is attributed to the user who connected the OAuth credential.
- Sharing a credential does not change its authenticated user identity.
- Document this limitation explicitly.
- Do not claim to provide per-execution user identity or an On-Behalf-Of flow.

### Testing and Documentation
- Use mocked OAuth and APIM responses for automated tests.
- Test delegated authentication, token expiry, refresh persistence, refresh failure, and revoked consent.
- Test rejection of invalid audiences, missing scopes, and app-only tokens.
- Test gateway URL construction and prevention of token disclosure.
- Test model discovery if supported; it must use the same delegated authentication path.
- Document credential setup, Entra app registration, APIM prerequisites, installation, compatibility, and credential-sharing implications.
- Run the scaffold's build, lint, and test commands before completing changes.