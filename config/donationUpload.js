const multer = require("multer");
const path = require("path");
const fs = require("fs");

const DONATION_UPLOAD_DIR = path.join(__dirname, "..", "uploads", "donations");
fs.mkdirSync(DONATION_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, DONATION_UPLOAD_DIR);
	},
	filename: function (req, file, cb) {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const safeExt = path.extname(file.originalname) || ".jpg";
		cb(null, `donation-${uniqueSuffix}${safeExt}`);
	}
});

const fileFilter = (req, file, cb) => {
	if (!file.mimetype.startsWith("image/")) {
		return cb(new Error("Only image files are allowed"), false);
	}
	cb(null, true);
};

module.exports = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: 5 * 1024 * 1024,
		files: 4
	}
});

