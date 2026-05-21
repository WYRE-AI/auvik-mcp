# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2024-05-21

### Added
- Initial release of Auvik MCP server
- Support for HTTP and stdio transports
- Multi-tenant support with AsyncLocalStorage-based credential injection
- 25+ tools covering all major Auvik API endpoints:
  - Status and navigation tools
  - Tenant management (list, get, detail)
  - Device management (list, get, details, warranty, lifecycle)
  - Network discovery (list, get)
  - Interface management (list)
  - Configuration management (list, get)
  - Entity management (notes, audits)
  - Alert management (list, get, dismiss)
  - Statistics (device, interface, service, SNMP poller)
  - Billing (client usage, device usage)
- Comprehensive error handling with proper MCP error mapping
- Empty-result handling to prevent LLM hallucination
- Docker containerization with multi-stage build
- Health check endpoint for container orchestration
- Type-safe implementation with Zod validation
- OSS hygiene files (README, LICENSE, CONTRIBUTING, etc.)
- GitHub Actions workflows for CI/CD
- Semantic release automation

### Security
- Credentials handled securely via environment variables or request headers
- No credential leakage in health check endpoint
- Proper input validation and sanitization