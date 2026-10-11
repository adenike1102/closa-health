import os
import tempfile

# Tests must never touch the real database. Set this before main.py is imported.
_tmp = tempfile.mkdtemp()
os.environ["CLOSA_DB"] = os.path.join(_tmp, "test.db")
