import requests
import re
import os
import html as html_module
from urllib.parse import urlparse

# List of slugs provided by the user
SLUGS = {
    "sir-bloody-skullhead-darryl-the-professionals",
"cmdr-frank-wet-sox-baroud-seal-frogman",
"crasswater-the-forgotten-guerrilla-warfare",
"sir-bloody-silent-darryl-the-professionals",
"sir-bloody-loudmouth-darryl-the-professionals",
"chef-d-escadron-rouchard-gendarmerie-nationale",
"sir-bloody-miami-darryl-the-professionals",
"medium-rare-crasswater-guerrilla-warfare",
"cmdr-mae-dead-cold-jamison-swat",
"cmdr-davida-goggles-fernandez-seal-frogman",
"the-doctor-romanov-sabre",
"lt-commander-ricksaw-nswc-seal",
"vypa-sista-of-the-revolution-guerrilla-warffare",
"sir-bloody-darryl-royale-the-professionals",
"special-agent-ava-fbi",
"the-elite-mr-muhlik-elite-crew",
"rezan-the-redshirt-sabre",
"number-k-the-professionals",
"two-times-mccoy-tacp-cavalry",
"elite-trapper-solman-guerrilla-warfare",
"bloody-darryl-the-strapped-the-professionals",
"safecracker-voltzmann-the-professionals",
"blackwolf-sabre",
"lieutenant-rex-krikey-seal-frogman",
"chem-haz-capitaine-gendarmerie-nationale",
"michael-syfers-fbi-sniper",
"two-times-mccoy-usaf-tacp",
"arno-the-overgrown-guerrilla-warfare",
"rezan-the-ready-sabre",
"1st-lieutenant-farlow-swat",
"prof-shahmat-elite-crew",
"blueberries-buckshot-nswc-seal",
"buckshot-nswc-seal",
"little-kev-the-professionals",
"getaway-sally-the-professionals",
"officer-jacques-beltram-gendarmerie-nationale",
"sous-lieutenant-medic-gendarmerie-nationale",
"dragomir-sabre",
"osiris-elite-crew",
"john-van-healen-kask-swat",
"maximus-sabre",
"markus-delrow-fbi-hrt",
"col-mangos-dabisi-guerrilla-warfare",
"trapper-guerrilla-warfare",
"lieutenant-tree-hugger-farlow-swat",
"sergeant-bombson-swat",
"slingshot-phoenix",
"chem-haz-specialist-swat",
"trapper-aggressor-guerrilla-warfare",
"jungle-rebel-elite-crew",
"dragomir-footsoldier",
"primeiro-tenente-brazilian-1st-battalion",
"d-squadron-officer-nzsas",
"bio-haz-specialist-swat",
"aspirant-gendarmerie-nationale",
"soldier-phoenix",
"b-squadron-officer-sas",
"ground-rebel-elite-crew",
"enforcer-phoenix",
"3rd-commando-company-ksk",
"street-soldier-phoenix",
"seal-team-6-soldier-nswc-seal",
"operator-fbi-swat",

}

def normalize_name(name):
    # Remove | and extra spaces, convert to lower case, replace spaces with hyphens
    name = name.replace("|", "").strip()
    # Remove multiple spaces
    name = re.sub(r'\s+', ' ', name)
    return name.lower().replace(" ", "-")

def get_case_name_from_url(url):
    path = urlparse(url).path
    # Example: /case/422/Fever-Case
    parts = path.split('/')
    if parts:
        return parts[-1].lower()
    return ""

import shutil

def download_image(url, filename, folder="images"):
    if not os.path.exists(folder):
        os.makedirs(folder)
    
    dest_path = os.path.join(folder, filename)
    if os.path.exists(dest_path):
        print(f"Skipping {filename}, already exists.")
        return

    # Check if it's a local file (from saved HTML)
    if os.path.exists(url):
        try:
            shutil.copy(url, dest_path)
            print(f"Copied local file to {filename}")
            return
        except Exception as e:
            print(f"Error copying local file {url}: {e}")
            return

    # Otherwise try downloading
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            with open(dest_path, 'wb') as f:
                f.write(response.content)
            print(f"Downloaded {filename}")
        else:
            print(f"Failed to download {url}: Status {response.status_code}")
    except Exception as e:
        print(f"Error downloading {url}: {e}")

def process_source(source):
    html = ""
    case_name = ""
    
    if os.path.isfile(source):
        print(f"Reading from file: {source}")
        with open(source, 'r', encoding='utf-8') as f:
            html = f.read()
        
        # Derive case name from filename
        base = os.path.splitext(os.path.basename(source))[0]
        # Remove common suffix from "Save As"
        base = base.replace(" Skins - CS2 Skins", "")
        # Normalize and handle underscores
        case_name = normalize_name(base).replace("_", "-")
    else:
        print(f"Processing URL: {source}")
        case_name = get_case_name_from_url(source)

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://stash.clash.gg/",
            "Upgrade-Insecure-Requests": "1"
        }
        
        try:
            response = requests.get(source, headers=headers)
            response.raise_for_status()
            html = response.text
        except Exception as e:
            print(f"Failed to fetch page: {e}")
            print("Tip: If you get a 403 Forbidden error, the site is protected. Save the page as HTML (e.g., 'fever-case.html') and run the script on that file.")
            return

    print(f"Case name derived: {case_name}")

    # Regex to find images with alt text
    # <img class="..." src="..." alt="...">
    # We look for src and alt attributes. Order might vary, so we scan for img tags first.
    
    img_tags = re.findall(r'<img[^>]+>', html)
    
    for tag in img_tags:
        # Extract src
        src_match = re.search(r'src="([^"]+)"', tag)
        # Extract alt
        alt_match = re.search(r'alt="([^"]+)"', tag)
        
        if src_match and alt_match:
            src = html_module.unescape(src_match.group(1))
            alt = html_module.unescape(alt_match.group(1))
            
            # Filter: Only keep images with '512fx384f' or 'light_large' in the URL
            if "512fx384f" not in src and "light_large" not in src:
                # print(f"Skipping {alt} - URL does not contain 512fx384f or light_large")
                continue

            # Skip if alt is empty or generic
            if not alt or alt.lower() == "image":
                continue

            normalized = normalize_name(alt)
            
            # Candidates
            # User requested to use just the slug name without the case suffix
            found_slug = normalized
            
            if found_slug:
                print(f"Processing: '{alt}' -> {found_slug} (High Res)")
                # Check if src is a valid URL
                if src.startswith("//"):
                    src = "https:" + src
                elif src.startswith("/"):
                    src = "https://stash.clash.gg" + src # Assuming base
                
                download_image(src, f"{found_slug}.png", folder=r"C:\Users\jojon\Desktop\csinvest\csinvest-frontend\src\assets\skins")
            else:
                # print(f"No match for '{alt}' (Normalized: {normalized})")
                pass

import glob

if __name__ == "__main__":
    # Process all HTML files in the current directory
    html_files = glob.glob("*.html")
    
    if not html_files:
        print("No HTML files found in the current directory.")
    else:
        print(f"Found {len(html_files)} HTML files to process.")
        for f in html_files:
            process_source(f)
