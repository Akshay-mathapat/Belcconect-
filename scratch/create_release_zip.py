import os
import zipfile
import shutil
import time

def make_zip():
    base_dir = r"c:\belconnect-withoutdocker\CityConnect"
    downloads_dir = r"C:\Users\AKSHAY MATHAPATI\Downloads"
    os.makedirs(downloads_dir, exist_ok=True)

    date_str = time.strftime("%Y-%m-%d")
    zip_dated = os.path.join(downloads_dir, f"CityConnect-Latest-Updated-{date_str}.zip")
    zip_latest = os.path.join(downloads_dir, "CityConnect-Latest-Updated.zip")

    exclude_dirs = {
        "node_modules", ".git", ".next", ".gemini", "__pycache__", ".turbo"
    }
    exclude_files = {
        "tokens_pool.json", "package-lock.json.bak"
    }

    print(f"Creating archive at {zip_dated}...")
    start_time = time.time()
    count = 0

    with zipfile.ZipFile(zip_dated, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for root, dirs, files in os.walk(base_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for f in files:
                if f in exclude_files or f.endswith(".pyc") or f.endswith(".log"):
                    continue
                if "tokens" in f.lower() and f != "tokens.example.json":
                    continue

                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, base_dir)
                zf.write(full_path, rel_path)
                count += 1

    shutil.copy2(zip_dated, zip_latest)
    elapsed = time.time() - start_time
    size_mb = os.path.getsize(zip_dated) / (1024 * 1024)
    print(f"Done! Archived {count} files into {zip_dated} and {zip_latest} in {elapsed:.2f}s ({size_mb:.2f} MB)")

if __name__ == "__main__":
    make_zip()

