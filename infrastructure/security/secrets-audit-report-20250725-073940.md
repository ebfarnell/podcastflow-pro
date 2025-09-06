# Secrets and Credentials Audit Report

Generated: Fri Jul 25 07:39:40 UTC 2025
Codebase: /home/ec2-user/podcastflow-pro

## Summary

This report identifies potential hardcoded secrets and credentials in the codebase.

## Findings

### CRITICAL: Hardcoded password
File: `/home/ec2-user/podcastflow-pro/src/app/login/page.tsx`
```
29:  { email: 'admin@podcastflow.pro', password: 'admin123', role: 'Admin', name: 'Admin User' },
30:  { email: 'seller@podcastflow.pro', password: 'seller123', role: 'Sales', name: 'Sales Representative' },
31:  { email: 'producer@podcastflow.pro', password: 'producer123', role: 'Producer', name: 'Show Producer' },
32:  { email: 'talent@podcastflow.pro', password: 'talent123', role: 'Talent', name: 'Podcast Host' },
33:  { email: 'client@podcastflow.pro', password: 'client123', role: 'Client', name: 'Client User' },
```

