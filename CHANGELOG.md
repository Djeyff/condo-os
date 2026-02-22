# Changelog

## [3.0.0] — 2026-02-22

### Added
- `scripts/setup.js` — one-command Notion setup: creates all 10 databases with relations, formulas, rollups, and color-coded selects. Zero manual steps.
- `scripts/condo-cli.js` — full CLI with 9 commands: fee-call, payment, statement, report, delinquency, dashboard, close-year, expense, assessment
- `scripts/import-excel.js` — Excel migration tool with auto-detection of sheet types (units, ledger, expenses, movements, budget)
- `config.json` configuration system — stores building info and all database IDs
- Account Movements database (10th DB) — full transaction history per cash account
- Multi-currency support via config
- Multilingual output (ES/EN/FR) for owner statements and reports
- Command aliases (pay, stmt, dash, delq, assess, etc.)
- Dry-run mode for year-end closing and Excel import
- Privacy guardrails enforced in all outputs

### Changed
- Complete rewrite from shell scripts to Node.js
- Relations now auto-wired via `dual_property` (no manual Notion steps)
- Formulas and rollups auto-created during setup
- `package.json` with proper dependencies

### Removed
- Legacy bash `setup-databases.sh` (replaced by `setup.js`)
- Legacy bash `backup-notion.sh` (to be rewritten)
- Manual setup instructions (automated)

## [2.0.0] — 2026-02-21

### Added
- Comprehensive SKILL.md with full accounting workflows
- 9 database schemas with detailed property definitions
- Communication templates (4 delinquency levels, fee calls, year-end statements)
- `install.sh` interactive installer
- `setup-databases.sh` bash-based DB creation
- Accounting guides and example scenarios
- SOUL.md and MEMORY.md templates

## [1.0.0] — 2026-02-20

- Initial release — documentation only
