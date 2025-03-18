# Token Faucet Project Guidelines

## Build Commands
- Build: `anchor build`
- Test: `anchor test`
- Test single file: `yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/token-faucet.ts`
- Deploy: `anchor deploy`
- Lint: `yarn lint`
- Fix linting: `yarn lint:fix`
- TypeCheck: `tsc --noEmit`

## Code Style Guidelines

### Rust (Solana Program)
- Use snake_case for functions, variables, and module names
- Use PascalCase for struct names and enum variants
- Organize imports with anchor_lang first, then other external crates
- Explicitly define error types in errors.rs with descriptive messages
- Use Result<()> for instruction functions, proper error handling with ? operator
- Use PDAs with consistent seed naming across program

### TypeScript (Tests/Client)
- Use camelCase for variables and functions
- Use PascalCase for class/interface names
- Prefer const over let where possible
- Use explicit typing when not obvious (especially for Anchor accounts)
- Use accountsStrict for transaction safety
- Format code with Prettier (`yarn lint:fix`)
- Properly handle and assert errors in tests