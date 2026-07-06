import sys, json
env = json.load(sys.stdin)
for e in env:
    if 'key' in e.lower() or 'api' in e.lower():
        print(e)
print("---")
print('\n'.join(env))