# Contributing to Auvik MCP Server

We welcome contributions to the Auvik MCP Server! This document provides guidelines for contributing to the project.

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm 10 or higher
- Docker (for container testing)

### Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/auvik-mcp.git
   cd auvik-mcp
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

5. Add your Auvik credentials to `.env`

6. Run tests to ensure everything works:
   ```bash
   npm test
   ```

## Development Workflow

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the coding standards below

3. Run the test suite:
   ```bash
   npm test
   ```

4. Run the linter:
   ```bash
   npm run lint
   ```

5. Build the project:
   ```bash
   npm run build
   ```

6. Test manually:
   ```bash
   npm run dev
   ```

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages:

- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `style:` formatting changes
- `refactor:` code refactoring
- `test:` adding or updating tests
- `chore:` maintenance tasks

Examples:
- `feat: add device warranty information tool`
- `fix: handle empty API responses correctly`
- `docs: update installation instructions`

### Pull Requests

1. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Create a pull request from your fork to the main repository
3. Fill out the pull request template with:
   - Clear description of changes
   - Link to any related issues
   - Screenshots/examples if applicable
   - Testing instructions

4. Ensure all CI checks pass
5. Address any review feedback

## Coding Standards

### TypeScript

- Use strict TypeScript configuration
- Avoid `any` type except at JSON:API boundaries
- Prefer type inference over explicit types when clear
- Use Zod for input validation
- Document complex type definitions

### Code Style

- Follow the existing code style
- Use meaningful variable and function names
- Keep functions small and focused
- Add comments for complex logic only
- Use early returns to reduce nesting

### Error Handling

- Always handle errors gracefully
- Use the `toMcpError` function for error mapping
- Return `isError: true` for empty results
- Provide descriptive error messages

### Testing

- Write tests for all new functionality
- Test both success and error cases
- Mock external API calls
- Maintain high test coverage

## Project Structure

```
src/
├── index.ts              # Main entry point
├── server.ts             # MCP server configuration
├── http-transport.ts     # HTTP transport layer
├── stdio-transport.ts    # Stdio transport layer
├── credentials.ts        # Credential management
├── client-factory.ts     # API client creation
├── errors.ts            # Error handling utilities
├── tools/               # Individual tool implementations
│   ├── status.ts
│   ├── navigate.ts
│   ├── tenants.ts
│   ├── devices.ts
│   └── ...
└── schemas/             # Zod validation schemas
    ├── common.ts
    ├── devices.ts
    └── ...
```

## Adding New Tools

To add a new Auvik API tool:

1. Create the tool implementation in `src/tools/`
2. Define Zod schemas in `src/schemas/` if needed
3. Add the tool to the imports and arrays in `src/server.ts`
4. Write tests in `tests/tools/`
5. Update the README tool list
6. Update the CHANGELOG

### Tool Template

```typescript
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials } from '../credentials.js';
import { createAuvikClient } from '../client-factory.js';
import { toMcpError } from '../errors.js';

export const yourToolName: Tool = {
  name: 'auvik_your_tool_name',
  description: 'Description of what this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      // Define input parameters
    },
    required: ['param1'],
    additionalProperties: false,
  },
};

export async function handleYourTool(args: YourArgsType): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text', text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.yourEndpoint.method(args);

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text', text: 'No matching resources found' }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };
  } catch (error) {
    const mcpError = toMcpError(error);
    return {
      content: [{ type: 'text', text: mcpError.message }],
      isError: true,
    };
  }
}
```

## Testing

### Unit Tests

Run unit tests with:
```bash
npm test
```

### Integration Tests

Test with a real Auvik API:
```bash
# Set up your credentials in .env
npm run build
npm start
```

### Docker Testing

```bash
docker build -t auvik-mcp:test .
docker run -e AUVIK_USERNAME=your_username -e AUVIK_API_KEY=your_key auvik-mcp:test
```

## Documentation

- Update README.md for user-facing changes
- Update CHANGELOG.md for all changes
- Add inline comments for complex logic
- Update API documentation if adding new tools

## Security

- Never commit credentials or sensitive data
- Use environment variables for configuration
- Validate all inputs with Zod
- Follow secure coding practices
- Report security issues privately to security@wyre.technology

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Contact the maintainers at engineering@wyre.technology

Thank you for contributing to Auvik MCP Server!