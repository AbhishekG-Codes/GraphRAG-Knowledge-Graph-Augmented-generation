arXiv Submission Package
========================

This directory contains the complete LaTeX source files for submission to arXiv.

Files included:
--------------
1. main.tex          - Main LaTeX document (IEEE conference format)
2. references.bib    - BibTeX bibliography file with all 28 references

Compilation Instructions:
-------------------------
To compile the paper, run:

    pdflatex main.tex
    bibtex main
    pdflatex main.tex
    pdflatex main.tex

This will generate main.pdf (13 pages).

Figures:
--------
All figures are generated using TikZ directly in main.tex.
No external image files are required.

Author Information:
------------------
Author: Abhishek G
Institution: Visvesvaraya Technological University
Department: Data Science and AI
Location: Bangalore, India
Email: abhishekgcodes@gmail.com

Repository:
-----------
Complete source code: https://github.com/abhishekg999/graphrag-explorer

Notes for arXiv:
----------------
- This paper uses IEEEtran document class (conference format)
- Bibliography is managed with BibTeX using IEEEtran.bst style
- No external figures - all diagrams are TikZ-generated
- The appendix uses single-column format for better readability
- Total page count: 13 pages
