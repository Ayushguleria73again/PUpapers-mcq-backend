# Server - pupapers.com API

The backend API for **pupapers.com**, providing authentication, content management, and quiz logic. Built with Node.js, Express, and MongoDB.

## 🚀 Tech Stack

*   **Runtime**: Node.js
*   **Framework**: Express.js
*   **Database**: MongoDB (via Mongoose)
*   **Authentication**: JWT (JSON Web Tokens) & Cookies
*   **File Storage**: Cloudinary (via Multer)
*   **Email**: Nodemailer (for OTP verification)

## 🛠️ API Structure

*   **/api/auth**: Authentication routes (Login, Signup, OTP, Profile).
*   **/api/content**: Content management (Subjects, Chapters, Questions, Results, Leaderboard).
*   **/api/admin**: Admin-specific operations (if separated, though currently integrated in content routes with middleware).

## 📦 Installation & Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Variables**:
    Create a `.env` file in the root of the `server` directory with the following keys:
    ```env
    PORT=5001
    MONGO_URI=mongodb+srv://<your-db-string>
    JWT_SECRET=<your-secret-key>
    
    # Cloudinary Config
    CLOUDINARY_CLOUD_NAME=<your-cloud-name>
    CLOUDINARY_API_KEY=<your-api-key>
    CLOUDINARY_API_SECRET=<your-api-secret>
    
    # Email Config (for OTPs)
    EMAIL_USER=support@pupapers.com
    EMAIL_PASS=<your-email-password>
    ```

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    The server will start on `http://localhost:5001`.

## 🔒 Security

*   **Role-Based Access**: `verifyAdmin` middleware protects sensitive mutation endpoints.
*   **Token Verification**: `verifyToken` middleware ensures authenticated access to private resources.
*   **Password Hashing**: Bcryptjs used for secure password storage.
