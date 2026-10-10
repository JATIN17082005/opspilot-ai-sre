import sys

def test_python_version():
    assert sys.version_info >= (3, 10), "Python version must be 3.10 or higher"

def test_imports():
    try:
        import pandas
        import sklearn
    except ImportError as e:
        assert False, f"Failed to import required libraries: {e}"
