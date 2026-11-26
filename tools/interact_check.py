#!/usr/bin/env python3
"""Kept for old runbook references. The map was rebuilt on 27 Nov 2026; this now runs tools/map_check.py.
Usage: python3 tools/interact_check.py <url> [outdir]"""
import sys, os, subprocess
sys.exit(subprocess.call([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'map_check.py')] + sys.argv[1:]))
