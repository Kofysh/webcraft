# Security Policy

## Supported Versions

| Version | Supported |
|---------|----------|
| latest (`main`) | ✅ |
| older commits | ❌ |

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, report them privately via one of these channels:

1. **GitHub Security Advisories** — click [Report a vulnerability](https://github.com/Kofysh/webcraft/security/advisories/new)
2. **Email** — contact the maintainer directly through their GitHub profile

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Your suggested fix (optional)

We will respond within **72 hours** and aim to release a patch within **7 days** for critical issues.

## Scope

In scope:
- Remote code execution via the WebSocket bridge
- Authentication bypass in the admin API
- Plugin loader path traversal
- Rate limiting bypass

Out of scope:
- Minecraft client-side issues
- Social engineering attacks
- Issues requiring physical access to the server

## Disclosure Policy

We follow **coordinated disclosure**. We ask that you give us a reasonable time to patch before going public.
