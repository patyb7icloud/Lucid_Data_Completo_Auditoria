import re
import os

def fix_file(fpath):
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to find any column declaration like:
    # `columnName` timestamp [anything optional] [,]
    # where it doesn't already contain "NOT NULL" or "NULL".
    # Let's find all lines containing `timestamp` and inspect them.
    lines = content.splitlines()
    new_lines = []
    fixed_count = 0
    
    for line in lines:
        # Check if line defines a timestamp column
        # e.g., `sentAt` timestamp DEFAULT null,
        # or `lastUsedAt` timestamp,
        if 'timestamp' in line and 'NOT NULL' not in line:
            # Check if it already has explicit NULL
            # Note: NULL might be part of "DEFAULT NULL" or "NULL DEFAULT NULL"
            # If we don't see "NULL" or "null" (but wait, "DEFAULT null" has "null" but not "NULL" or maybe it has "null" but lacks the "NULL" keyword defining nullability)
            # Actually, to be safe, if it does not contain " NULL " (with spaces) or "NULL " or " NULL", let's make it explicit.
            # Let's match: `name` timestamp ...
            match = re.search(r'(\s*`\w+`\s+timestamp)(.*)', line)
            if match:
                prefix = match.group(1) # e.g. "	`sentAt` timestamp"
                rest = match.group(2)   # e.g. " DEFAULT null," or ","
                
                # Check if "NULL" is already specified as nullability (i.e. "NULL" without "DEFAULT")
                # To be absolutely sure, let's just rewrite the line to be:
                # `columnName` timestamp NULL DEFAULT NULL, (if it was nullable)
                # Let's see: if "NOT NULL" is not in it:
                # We can strip any existing default/nullability and replace with "NULL DEFAULT NULL"
                # Let's find if there is a comma at the end of rest
                has_comma = rest.endswith(',') or rest.endswith(',--> statement-breakpoint') or rest.endswith(';')
                suffix = ''
                if rest.endswith(',--> statement-breakpoint'):
                    suffix = ',--> statement-breakpoint'
                elif rest.endswith(';'):
                    suffix = ';'
                elif rest.endswith(','):
                    suffix = ','
                
                # Re-construct: prefix + " NULL DEFAULT NULL" + suffix
                line = prefix + " NULL DEFAULT NULL" + suffix
                fixed_count += 1
        
        new_lines.append(line)
        
    new_content = '\n'.join(new_lines)
    if fixed_count > 0:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Fixed {fixed_count} lines in {fpath}")

# Run on all SQL files in drizzle directory
drizzle_dir = 'drizzle'
for fname in os.listdir(drizzle_dir):
    if fname.endswith('.sql'):
        fix_file(os.path.join(drizzle_dir, fname))
