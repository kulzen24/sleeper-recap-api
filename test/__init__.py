import os
import sys

# The Worker's modules live under src/ (that's the module root wrangler
# uploads), so make them importable for tests the same way.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
