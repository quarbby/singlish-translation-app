#!/usr/bin/env python3

import pandas as pd

df = pd.read_excel('Translations.xlsx', sheet_name="ALL_TRANSLATIONS", header=None)

df['filename'] = df[3].apply(lambda x: x.replace('inputs/', ''))

value_counts = df['filename'].value_counts()
frequent_values = value_counts[value_counts >= 45].index.tolist()

with open('done_files.txt', 'w') as f:
    for fv in frequent_values:
        f.write(fv + '\n')
f.close()