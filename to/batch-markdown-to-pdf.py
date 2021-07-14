from pathlib import Path
import os

work_dir = Path.cwd()


for md_file in list(work_dir.glob('*.md')):
    md_file_name = md_file.name
    pdf_file_name = md_file_name.replace('.md', '.pdf')
    cmd = f"""pandoc {md_file_name} -o pdf/{pdf_file_name} --pdf-engine=xelatex -V mainfont='MathType' --template=template.tex"""
    print(cmd)
    os.system(cmd)