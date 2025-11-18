require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/dbConnection");
const User = require("../models/user");
const Donation = require("../models/donation");

const run = async () => {
	try {
		await connectDB();

		const userResult = await User.deleteMany({});
		const donationResult = await Donation.deleteMany({});

		let sessionsDeleted = 0;
		try {
			const sessionResult = await mongoose.connection.collection("sessions").deleteMany({});
			sessionsDeleted = sessionResult.deletedCount || 0;
		} catch (err) {
			if (err.codeName !== "NamespaceNotFound") {
				console.warn("⚠️  Could not clear sessions collection:", err.message);
			}
		}

		console.log("✅ Database reset complete:");
		console.log(` - Users removed: ${userResult.deletedCount}`);
		console.log(` - Donations removed: ${donationResult.deletedCount}`);
		console.log(` - Sessions removed: ${sessionsDeleted}`);
	}
	catch (error)
	{
		console.error("❌ Failed to reset database:", error.message);
		process.exitCode = 1;
	}
	finally
	{
		await mongoose.connection.close();
	}
};

run();

