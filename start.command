#!/bin/zsh
set -eu
cd -- "${0:A:h}"
exec "$HOME/.local/bin/uv" run --frozen python agent.py console "$@"
