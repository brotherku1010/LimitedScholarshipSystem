import os
import re

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def main():
    print("Starting HTML Rebuild Process...")
    
    # 1. Load static assets
    style_css = read_file("static/css/style.css")
    admin_css = read_file("static/css/admin.css")
    gas_app_js = read_file("static/js/gas_app.js")
    gas_admin_app_js = read_file("static/js/gas_admin_app.js")
    
    # 2. Rebuild index.html (Student Portal)
    print("Rebuilding index.html...")
    index_tpl = read_file("templates/index.html")
    
    # Replace style.css link with inline style block
    css_pattern = r'<link\s+rel=["\']stylesheet["\']\s+href=["\']/static/css/style\.css["\']\s*>'
    css_replacement = f"<style>\n{style_css}\n</style>"
    index_html = re.sub(css_pattern, lambda m: css_replacement, index_tpl)
    
    # Replace FontAwesome CSS link with JS script kit to allow SVG rendering in GAS iframes
    fa_pattern = r'<link\s+rel=["\']stylesheet["\']\s+href=["\']https://cdnjs\.cloudflare\.com/ajax/libs/font-awesome/6\.4\.0/css/all\.min\.css["\']\s*>'
    fa_replacement = '<script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>'
    index_html = re.sub(fa_pattern, lambda m: fa_replacement, index_html)
    
    # Replace app.js script tag with inline GAS JS code
    js_pattern = r'<script\s+src=["\']/static/js/app\.js["\']\s*></script>'
    js_replacement = f"<script>\n{gas_app_js}\n</script>"
    index_html = re.sub(js_pattern, lambda m: js_replacement, index_html)
    
    write_file("index.html", index_html)
    print("Rebuilt index.html successfully!")
 
    # 3. Rebuild admin.html (Admin Dashboard)
    print("Rebuilding admin.html...")
    admin_tpl = read_file("templates/admin.html")
    
    # Replace admin.css link with inline style block
    admin_css_pattern = r'<link\s+rel=["\']stylesheet["\']\s+href=["\']/static/css/admin\.css["\']\s*>'
    admin_css_replacement = f"<style>\n{admin_css}\n</style>"
    admin_html = re.sub(admin_css_pattern, lambda m: admin_css_replacement, admin_tpl)
    
    # Replace FontAwesome CSS link with JS script kit
    admin_html = re.sub(fa_pattern, lambda m: fa_replacement, admin_html)
    
    # Replace the existing script tag with our GAS admin JS code
    admin_script_pattern = r'<script>.*?</script>'
    admin_script_replacement = f"<script>\n{gas_admin_app_js}\n</script>"
    admin_html = re.sub(admin_script_pattern, lambda m: admin_script_replacement, admin_html, flags=re.DOTALL)
    
    write_file("admin.html", admin_html)
    print("Rebuilt admin.html successfully!")
 
    # 4. Rebuild admin_login.html (Admin Login Modal)
    print("Rebuilding admin_login.html...")
    login_tpl = read_file("templates/admin_login.html")
    
    # Replace admin.css link with inline style block
    login_html = re.sub(admin_css_pattern, lambda m: admin_css_replacement, login_tpl)
    # Replace FontAwesome CSS link
    login_html = re.sub(fa_pattern, lambda m: fa_replacement, login_html)
    
    write_file("admin_login.html", login_html)
    print("Rebuilt admin_login.html successfully!")
    
    # 5. Rebuild portal.html (Intro Portal Page)
    print("Rebuilding portal.html...")
    portal_tpl = read_file("templates/portal.html")
    # Replace style.css link with inline style block
    portal_html = re.sub(css_pattern, lambda m: css_replacement, portal_tpl)
    # Replace FontAwesome CSS link
    portal_html = re.sub(fa_pattern, lambda m: fa_replacement, portal_html)
    write_file("portal.html", portal_html)
    print("Rebuilt portal.html successfully!")
    
    print("All template files compiled successfully for Google Apps Script deployment!")

if __name__ == "__main__":
    main()
