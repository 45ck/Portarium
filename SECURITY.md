# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

We support security updates for the latest release only. Older versions are not guaranteed to receive patches.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

To report a vulnerability, use GitHub's private vulnerability reporting feature:

1. Go to the [Security tab](../../security) of this repository.
2. Click **"Report a vulnerability"**.
3. Provide a description, reproduction steps, and any relevant details.

We aim to acknowledge reports within **5 business days** and provide an initial assessment within **10 business days**.

## Disclosure Policy

- We follow responsible disclosure practices.
- Once a fix is available, we will coordinate a disclosure timeline with the reporter.
- Credit will be given to reporters in release notes unless they prefer to remain anonymous.

## Security Scope

The following are **in scope** for vulnerability reports:

- Authentication and authorization bypass
- Remote code execution
- Privilege escalation
- Data exfiltration or tenant isolation failures
- Cryptographic weaknesses in token handling or evidence integrity
- Injection vulnerabilities (SQL, command, prompt injection in agentic workflows)
- Supply-chain issues in published artifacts

The following are **out of scope**:

- Vulnerabilities in third-party dependencies that have already been publicly disclosed
- Denial-of-service attacks requiring significant resources
- Social engineering attacks
- Issues in development or demo environments

## Contact

For non-sensitive security questions, open a discussion in the [GitHub Discussions](../../discussions) tab.
