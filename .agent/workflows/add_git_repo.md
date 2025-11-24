---
description: Initialize a git repository and push to a remote
---

1. Initialize the repository
```bash
git init
```

2. Add all files
```bash
git add .
```

3. Commit the files
```bash
git commit -m "Initial commit"
```

4. Add the remote repository (Replace <YOUR_REPO_URL> with your actual URL)
```bash
git remote add origin <YOUR_REPO_URL>
```

5. Push to the remote
```bash
git push -u origin main
```
