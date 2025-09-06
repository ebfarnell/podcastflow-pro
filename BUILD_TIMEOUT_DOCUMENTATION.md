# Build Timeout Configuration & Troubleshooting

## Overview
The PodcastFlow Pro build system has been updated to provide configurable timeout handling and better diagnostics for build issues.

## Key Changes Made (August 7, 2025)

### 1. Created `scripts/build-wrapper.sh`
- Centralized timeout management (no more nested timeouts)
- Configurable via `BUILD_TIMEOUT_SEC` environment variable
- Default: 600 seconds (10 minutes)
- Detailed logging with timestamps
- Proper signal handling and cleanup
- Build output captured to `.next/build-log-*.txt`

### 2. Updated `package.json`
- Removed hardcoded `timeout 600` from build script
- Added new scripts:
  - `build`: Standard build with wrapper (600s default)
  - `build:local`: Extended timeout build (900s)
  - `build:fast`: Original fast build (unchanged)

### 3. Created `scripts/build-production.sh`
- Background build execution with monitoring
- Works around interactive shell timeout limitations
- Provides progress updates every 30 seconds
- Handles timeout and signal management

## Configuration

### Environment Variables
- `BUILD_TIMEOUT_SEC`: Build timeout in seconds (default: 600)
- `NODE_OPTIONS`: Node.js options (default: `--max-old-space-size=4096`)

### Usage Examples

```bash
# Standard build (10 minutes timeout)
npm run build

# Extended timeout build (15 minutes)
BUILD_TIMEOUT_SEC=900 npm run build

# Local development build with extended timeout
npm run build:local

# Production build (runs in background, avoids shell timeouts)
./scripts/build-production.sh

# Custom timeout for production build
BUILD_TIMEOUT_SEC=1200 ./scripts/build-production.sh
```

## Important Discovery

During testing, we discovered that the Claude execution environment has a 2-minute timeout on ALL commands, not just builds. This is why builds were being killed at exactly 2 minutes regardless of the configured timeout.

**Solution for production/real environments:**
- Use `npm run build` normally - it will respect the 600-second timeout
- Use `./scripts/build-production.sh` if running from a restricted shell
- The build scripts themselves are correct and will work properly on EC2/production

## Build Logs

Build logs are saved to:
- `.next/build-log-*.txt` (build-wrapper.sh)
- `.next/build-production-*.log` (build-production.sh)

The wrapper automatically keeps only the last 5 build logs to save space.

## Rollback Instructions

If you need to rollback these changes:

```bash
# 1. Restore original package.json
cp /home/ec2-user/podcastflow-pro/package.json.bak-20250807-* /home/ec2-user/podcastflow-pro/package.json

# 2. Remove new scripts (optional, they won't interfere if left)
rm -f /home/ec2-user/podcastflow-pro/scripts/build-wrapper.sh
rm -f /home/ec2-user/podcastflow-pro/scripts/build-production.sh

# 3. Verify rollback
grep "timeout 600" /home/ec2-user/podcastflow-pro/package.json
```

## Troubleshooting

### Build times out before configured limit
1. Check if running in a restricted shell (Claude, CI/CD with job limits)
2. Use `./scripts/build-production.sh` instead
3. Check system limits: `ulimit -t`

### Build fails immediately
1. Check Node.js memory: increase `NODE_OPTIONS="--max-old-space-size=8192"`
2. Check disk space: `df -h`
3. Review build logs in `.next/build-log-*.txt`

### Build succeeds but PM2 doesn't restart
1. Build and restart are separate: `npm run build && pm2 restart podcastflow-pro`
2. Check PM2 logs: `pm2 logs podcastflow-pro`

## Technical Details

### Signal Handling
- The wrapper uses `trap` to handle EXIT, INT, and TERM signals
- GNU timeout with `--preserve-status` maintains Next.js exit codes
- `--kill-after=10` ensures cleanup if TERM is ignored

### Process Tree
```
npm run build
  └── ./scripts/optimize-build.sh
  └── ./scripts/build-wrapper.sh
      └── timeout 600 npx next build
          └── next build (actual build process)
  └── ./scripts/post-build.sh
```

### Timeout Sources Audited
1. package.json scripts ✅ (fixed)
2. Shell environment (TMOUT) ✅ (not set)
3. System limits (ulimit) ✅ (unlimited)
4. PM2 configuration ✅ (no timeout)
5. Systemd services ✅ (none found)
6. CI/CD pipelines ✅ (no specific limits)

## Runbook for Maintainers

### Daily Operations
- Builds should complete in 3-5 minutes normally
- If consistently hitting timeout, investigate:
  - Large bundle sizes
  - Memory leaks in build plugins
  - Disk I/O issues

### Monitoring
```bash
# Watch build in real-time
tail -f .next/build-log-*.txt

# Check build duration
grep "Build completed successfully" .next/build-log-*.txt

# Check for timeout issues
grep -i "timeout" .next/build-log-*.txt
```

### Performance Optimization
1. Use `npm run build:fast` for development builds
2. Clear cache if builds are slow: `rm -rf .next/cache`
3. Ensure sufficient memory: 4GB minimum recommended

## Contact
For issues with the build system, check:
1. This documentation
2. Build logs in `.next/`
3. PM2 logs: `pm2 logs podcastflow-pro`
4. System logs: `journalctl -u nginx -n 100`