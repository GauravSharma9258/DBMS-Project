const express = require("express");
const router = express.Router();
const middleware = require("../middleware/index.js");
const User = require("../models/user.js");

router.get("/api/locations", middleware.ensureLoggedIn, async (req, res) => {
	try {
		const donors = await User.find({
			role: "donor",
			verificationStatus: "approved",
			latitude: { $ne: null },
			longitude: { $ne: null }
		}).select("firstName lastName restaurantName latitude longitude restaurantAddress phone");

		const agents = await User.find({
			role: "agent",
			verificationStatus: "approved",
			latitude: { $ne: null },
			longitude: { $ne: null }
		}).select("firstName lastName restaurantName latitude longitude restaurantAddress restaurantPhone");

		res.json({
			success: true,
			donors,
			agents
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, message: "Unable to fetch locations" });
	}
});

module.exports = router;

