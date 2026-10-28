# How to Upload Nestora to Your GitHub Account

Your project has already been initialized with a clean Git repository on your Desktop:
**Path:** `C:\Users\Ameen\Desktop\nestora-pg-management-system`

Follow these 3 simple steps to push it to GitHub:

---

### Step 1: Create a New Repository on GitHub
1. Open your web browser and log in to [GitHub](https://github.com/).
2. Click the **"+"** icon in the top-right corner and choose **"New repository"** (or visit [https://github.com/new](https://github.com/new)).
3. Fill in the repository details:
   - **Repository name**: `nestora-pg-management-system` (or your preferred name)
   - **Visibility**: Choose **Public** (or Private)
   - **Do NOT check** "Add a README file", "Add .gitignore", or "Choose a license" (we already included them!)
4. Click **"Create repository"**.

---

### Step 2: Copy Your GitHub Repository URL
Copy the HTTPS URL shown on your GitHub page, which looks like:
`https://github.com/YOUR_USERNAME/nestora-pg-management-system.git`

---

### Step 3: Run These Two Commands
Open PowerShell or Command Prompt, navigate to your Desktop project folder, and run:

```powershell
cd C:\Users\Ameen\Desktop\nestora-pg-management-system

git remote add origin https://github.com/YOUR_USERNAME/nestora-pg-management-system.git

git push -u origin main
```
*(Replace `YOUR_USERNAME` with your actual GitHub username)*

---

### That's it!
All files, database schema, HTML templates, CSS styles, JavaScript controllers, and documentation will instantly appear on your GitHub profile.
