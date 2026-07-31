# CI/CD Pipeline Configuration

This repository includes a comprehensive CI/CD pipeline to ensure code quality, automated testing, and secure deployments.

## Overview

The CI/CD pipeline includes several jobs:

1. **Backend Tests**: Runs pytest on the backend code with PostgreSQL 18
2. **Frontend Tests**: Runs Playwright E2E tests for the frontend
3. **Migration Validation**: Validates database migrations
4. **Security Scan**: Performs security audits with Bandit and Safety
5. **Deploy to Staging**: Manual deployment to staging environment
6. **Release**: Manual deployment to production environment

## Requirements

- GitHub account with repository access
- Access to Docker Hub or other container registry
- Deployment servers for staging and production (or use CI environments)

## Configuration

The pipeline is configured in `.github/workflows/ci-cd.yml` and includes:

### Backend Tests
- Uses PostgreSQL 18 on Windows for local testing
- Runs all pytest tests including data integrity tests
- Validates RLS policies and audit trails
- Skips tests with known Windows-specific event loop cleanup issues

### Frontend Tests
- Uses Node.js 18 and 20 on Ubuntu
- Runs Playwright E2E tests
- Validates linting and type checking

### Migration Validation
- Validates Alembic migration files
- Tests migration upgrade/downgrade cycles
- Ensures database schema consistency

### Security Scanning
- Runs Safety for Python dependencies
- Uses Bandit for Python code security analysis

## Running Locally

You can run the pipeline locally using GitHub Actions CLI or by following the steps in each job.

## Best Practices

1. **Branch Protection**: Protect the `main` branch and require CI passes before merge
2. **Secret Management**: Use GitHub secrets for API keys, passwords, and tokens
3. **Caching**: Cache dependencies and test artifacts to speed up builds
4. **Parallel Testing**: Run parallel tests to reduce overall CI time
5. **Artifact Management**: Store test artifacts for debugging

## Future Improvements

1. **Docker-based Testing**: Use Docker containers for consistent environments
2. **Performance Testing**: Add performance benchmarks to the CI pipeline
3. **Accessibility Testing**: Include accessibility testing for the frontend
4. **Integration Testing**: Add integration tests for external services

## Files Modified

This pipeline replaces the need for manual testing and deployment scripts by providing:

- Automated testing on every push and pull request
- Security scanning to catch vulnerabilities early
- Deployment pipelines for staging and production
- Artifact storage for debugging and monitoring

## Support

For issues with the CI/CD pipeline, please refer to the GitHub Actions documentation or the workflow file itself.
