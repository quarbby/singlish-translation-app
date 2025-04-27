#!/usr/bin/env python3
"""
Manifest Generator

This script generates a manifest.json file containing all CSV files in the inputs/ directory.
Run this script whenever you add new CSV files to the inputs/ directory.

Usage:
    python manifest_generator.py

"""

import os
import json
from datetime import datetime

# Configuration
INPUT_DIRECTORY = 'inputs/'
OUTPUT_FILE = 'manifest.json'
DONE_FILES_PATH = 'done_files.txt'

def generate_manifest():
    """Generate a manifest.json file with all CSV files in the input directory."""
    try:
        # Check if directory exists
        if not os.path.exists(INPUT_DIRECTORY):
            print(f"Error: Directory '{INPUT_DIRECTORY}' does not exist")
            return False
        
        # Read the done_files.txt to get files to exclude
        done_files = []
        if os.path.exists(DONE_FILES_PATH):
            with open(DONE_FILES_PATH, 'r', encoding='utf-8') as f:
                done_files = [line.strip() for line in f.readlines()]

        # Get all files in the directory
        all_files = os.listdir(INPUT_DIRECTORY)
        
        # Filter for CSV files only (case insensitive)
        csv_files = [file for file in all_files if file.lower().endswith('.csv') and file not in done_files]
        
        if not csv_files:
            print(f"Warning: No CSV files found in '{INPUT_DIRECTORY}'")
        
        # Create manifest object
        manifest = {
            "lastUpdated": datetime.now().isoformat(),
            "files": [f"{INPUT_DIRECTORY}{file}" for file in csv_files]
        }
        
        # Write manifest to file
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2)
        
        print(f"Manifest generated successfully with {len(csv_files)} CSV files.")
        print(f"Saved to {OUTPUT_FILE}")
        
        # Print the list of files included
        if csv_files:
            print("\nFiles included:")
            for file in csv_files:
                print(f"  - {INPUT_DIRECTORY}{file}")
        
        return True
    
    except Exception as e:
        print(f"Error generating manifest: {e}")
        return False

if __name__ == "__main__":
    generate_manifest()