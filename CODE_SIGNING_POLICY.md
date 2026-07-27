# Code signing policy

## Status

The project is preparing an application to the SignPath Foundation open-source
program. Windows releases published before SignPath approval are unsigned.
After approval and configuration, this policy will govern every signed Windows
release.

Free code signing provided by
[SignPath.io](https://signpath.io/), certificate by
[SignPath Foundation](https://signpath.org/).

## Project

- Project: Instructional Designer
- Repository:
  <https://github.com/CharlieCardenasToledo/instructional-designer-skill>
- License: MIT
- Maintainer: [Charlie Cárdenas Toledo](https://github.com/CharlieCardenasToledo)

The repository contains the complete source code and build definitions for the
desktop application and its bundled instructional-design skill. The project
does not use commercial dual licensing or proprietary project-owned
components.

## Team roles

- Authors and committers:
  [Charlie Cárdenas Toledo](https://github.com/CharlieCardenasToledo)
- Reviewers: the repository owner reviews all changes from external
  contributors before merge.
- Signing approver:
  [Charlie Cárdenas Toledo](https://github.com/CharlieCardenasToledo)

All people assigned to these roles must use multi-factor authentication on
GitHub and SignPath.

## Eligible artifacts

Only these Windows artifacts may be signed:

- the NSIS installer produced by Tauri;
- the Windows Installer MSI produced by Tauri;
- project-owned executable files contained in those installers when the
  SignPath artifact configuration explicitly identifies them.

Third-party libraries may be packaged but must not be signed with the
project's SignPath policy.

## Trusted build and release process

Signed artifacts must:

1. originate from this repository;
2. be built by `.github/workflows/release-windows.yml`;
3. run entirely on GitHub-hosted runners;
4. pass documentation, application, and Rust tests;
5. be uploaded to GitHub Actions before the signing request;
6. pass SignPath origin verification;
7. receive manual approval in SignPath;
8. pass an Authenticode verification step after signing;
9. be published by the same workflow without local replacement.

Local builds, manually uploaded binaries, workflow artifacts from forks, and
artifacts from untrusted runners are not eligible for signing.

## Version and metadata

The product name must be `Instructional Designer Manager`. File and product
versions must match the application version declared in the repository for
each build. SignPath artifact rules must reject unexpected product names or
inconsistent versions.

## Privacy

The project does not collect telemetry or transfer information to a
project-owned service. Network operations happen only when explicitly
requested by the user, such as NotebookLM authentication and queries,
institutional website palette extraction, dependency installation, or
uploading a skill to Claude.

See the complete [privacy policy](PRIVACY.md).

## Verification

Users can verify an installer in Windows PowerShell:

```powershell
Get-AuthenticodeSignature -LiteralPath ".\installer.exe" |
  Format-List Status,SignerCertificate,TimeStamperCertificate
```

A signed release must return `Status: Valid` and identify SignPath Foundation
as the signer. Checksums alone are not considered a code signature.

## Incident response

Suspected certificate misuse, unexpected signed artifacts, or compromised
release credentials must be reported according to [SECURITY.md](SECURITY.md).
The maintainer will suspend signing, preserve build evidence, notify SignPath,
and request revocation when appropriate.
