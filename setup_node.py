import os
import sys
import urllib.request
import zipfile
import subprocess

def download_progress(block_num, block_size, total_size):
    read_so_far = block_num * block_size
    if total_size > 0:
        percent = min(100, read_so_far * 100 // total_size)
        sys.stdout.write(f"\rDownloading Node.js: {percent}% ({read_so_far // 1024 // 1024}MB / {total_size // 1024 // 1024}MB)")
    else:
        sys.stdout.write(f"\rDownloading Node.js: {read_so_far // 1024 // 1024}MB")
    sys.stdout.flush()

def main():
    # Force working directory to script location
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    dest_dir = "node-portable"
    zip_path = "node.zip"
    node_exe_path = os.path.join(dest_dir, "node-v20.12.2-win-x64", "node.exe")
    
    if os.path.exists(node_exe_path):
        print("Node.js portable is already installed!")
        # Ensure clasp is installed
        clasp_cmd = os.path.join(dest_dir, "node-v20.12.2-win-x64", "clasp.cmd")
        if not os.path.exists(clasp_cmd):
            install_clasp(os.path.join(dest_dir, "node-v20.12.2-win-x64"))
        return

    # Clean up any previously corrupted downloads/folders
    if os.path.exists(zip_path):
        os.remove(zip_path)
    if os.path.exists(dest_dir):
        # Clean up existing node-portable using shell
        print("Cleaning up old folder...")
        import shutil
        try:
            shutil.rmtree(dest_dir)
        except:
            pass

    url = "https://nodejs.org/dist/v20.12.2/node-v20.12.2-win-x64.zip"
    print(f"Downloading Node.js from: {url}")
    try:
        urllib.request.urlretrieve(url, zip_path, download_progress)
        print("\nDownload complete! Extracting files...")
    except Exception as e:
        print(f"\nDownload failed: {e}")
        return
        
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(dest_dir)
        print("Extraction complete! Cleaning up zip...")
        if os.path.exists(zip_path):
            os.remove(zip_path)
    except Exception as e:
        print(f"Extraction failed: {e}")
        return

    # Install clasp
    node_dir = os.path.join(dest_dir, "node-v20.12.2-win-x64")
    install_clasp(node_dir)
    print("\n==================================================================")
    print("Environment setup successful! You can now run deploy_to_gas.bat.")
    print("==================================================================")

def install_clasp(node_dir):
    print("Installing Google Clasp tool locally inside portable Node...")
    # Add node_dir to path temporarily to run npm
    env = os.environ.copy()
    env["PATH"] = os.path.abspath(node_dir) + os.path.pathsep + env.get("PATH", "")
    npm_cmd = os.path.join(node_dir, "npm.cmd")
    
    try:
        subprocess.run([npm_cmd, "install", "-g", "@google/clasp"], env=env, check=True)
        print("Clasp installed successfully!")
    except Exception as e:
        print(f"Clasp installation failed: {e}")

if __name__ == "__main__":
    main()
