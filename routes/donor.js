const express = require("express");
const path = require("path");
const router = express.Router();
const middleware = require("../middleware/index.js");
const User = require("../models/user.js");
const Donation = require("../models/donation.js");
const donationUpload = require("../config/donationUpload");
const { autoAssignAgents } = require("../services/autoAssignment");


router.get("/donor/dashboard", middleware.ensureDonorLoggedIn, async (req,res) => {
	const donorId = req.user._id;
	const numPendingDonations = await Donation.countDocuments({ donor: donorId, status: "pending" });
	const numAssignedDonations = await Donation.countDocuments({ donor: donorId, status: "assigned" });
	const numCollectedDonations = await Donation.countDocuments({ donor: donorId, status: "collected" });
	res.render("donor/dashboard", {
		title: "Dashboard",
		numPendingDonations, numAssignedDonations, numCollectedDonations
	});
});

router.get("/donor/verification", middleware.ensureDonorLoggedIn, (req, res) => {
	res.render("donor/verification", {
		title: "Verification status"
	});
});

router.get("/donor/donate", middleware.ensureDonorLoggedIn, middleware.ensureVerifiedDonor, (req,res) => {
	res.render("donor/donate", { title: "Donate" });
});

const donationPhotoUploader = donationUpload.array("donationPhotos", 4);
const toDonationPhotoPath = (filePath) => `/uploads/donations/${path.basename(filePath)}`;

router.post("/donor/donate",
	middleware.ensureDonorLoggedIn,
	middleware.ensureVerifiedDonor,
	(req,res,next) => {
		donationPhotoUploader(req,res,(err) => {
			if (err) {
				req.flash("error", err.message || "Unable to upload photos.");
				return res.redirect("back");
			}
			next();
		});
	},
	async (req,res) => {
	try
	{
        const donation = req.body.donation;
        donation.status = "pending";
        donation.donor = req.user._id;

        if(!donation.latitude || !donation.longitude)
        {
            req.flash("error", "Please mark your pickup location on the map before submitting.");
            return res.redirect("back");
        }

        const latitude = parseFloat(donation.latitude);
        const longitude = parseFloat(donation.longitude);

        if(Number.isNaN(latitude) || Number.isNaN(longitude))
        {
            req.flash("error", "Invalid location selected. Please place the marker again.");
            return res.redirect("back");
        }

        donation.latitude = latitude;
        donation.longitude = longitude;

        if (!donation.expiryTime) {
            req.flash("error", "Please provide an expiry time for the food.");
            return res.redirect("back");
        }
        const expiryTime = new Date(donation.expiryTime);
        if (isNaN(expiryTime.getTime())) {
            req.flash("error", "Invalid expiry time provided.");
            return res.redirect("back");
        }
        donation.expiryTime = expiryTime;

        if (req.files && req.files.length) {
            donation.donationPhotos = req.files.map(file => toDonationPhotoPath(file.path));
        }

        const newDonation = new Donation(donation);
        await newDonation.save();
        await autoAssignAgents(newDonation._id);
		req.flash("success", "Donation request sent successfully");
		res.redirect("/donor/donations/pending");
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
});

router.get("/donor/donations/pending", middleware.ensureDonorLoggedIn, async (req,res) => {
	try
	{
		const pendingDonations = await Donation.find({ donor: req.user._id, status: { $in: ["pending", "rejected", "assigned"] } }).populate("agent");
		res.render("donor/pendingDonations", { title: "Pending Donations", pendingDonations });
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
});

router.get("/donor/donations/previous", middleware.ensureDonorLoggedIn, async (req,res) => {
	try
	{
		const previousDonations = await Donation.find({ donor: req.user._id, status: "collected" }).populate("agent");
		res.render("donor/previousDonations", { title: "Previous Donations", previousDonations });
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
});

router.get("/donor/track", middleware.ensureDonorLoggedIn, async (req,res) => {
	try {
		const donations = await Donation.find({ donor: req.user._id, status: { $in: ["pending", "assigned", "picked_up", "collected", "rejected"] } })
			.populate("agent")
			.sort({ createdAt: -1 });
		res.render("donor/track", { title: "Track donations", donations });
	} catch(err) {
		console.log(err);
		req.flash("error", "Unable to load tracking data.");
		res.redirect("back");
	}
});

router.post("/donor/donation/confirmPickup/:donationId", middleware.ensureDonorLoggedIn, async (req,res) => {
	try {
		const donation = await Donation.findOne({ _id: req.params.donationId, donor: req.user._id });
		if (!donation) {
			req.flash("error", "Donation not found.");
			return res.redirect("back");
		}
		if (donation.status !== "assigned") {
			req.flash("warning", "Pickup can only be confirmed after an NGO accepts.");
			return res.redirect("back");
		}
		donation.status = "picked_up";
		donation.pickupConfirmedAt = new Date();
		await donation.save();
		req.flash("success", "Great! Thanks for confirming the handoff.");
		res.redirect("/donor/track");
	} catch(err) {
		console.log(err);
		req.flash("error", "Unable to update donation.");
		res.redirect("back");
	}
});

router.post("/donor/donations/clear", middleware.ensureDonorLoggedIn, async (req,res) => {
	try {
		await Donation.deleteMany({ donor: req.user._id, status: { $in: ["collected", "rejected"] } });
		req.flash("success", "Past donation records cleared.");
		res.redirect("/donor/track");
	} catch(err) {
		console.log(err);
		req.flash("error", "Unable to clear records right now.");
		res.redirect("back");
	}
});

router.get("/donor/proofs", middleware.ensureDonorLoggedIn, async (req,res) => {
	try {
		const donations = await Donation.find({ donor: req.user._id }).populate("agent").sort({ createdAt: -1 });
		res.render("donor/proofs", { title: "Donation photos", donations });
	} catch(err) {
		console.log(err);
		req.flash("error", "Unable to load photos right now.");
		res.redirect("back");
	}
});

router.get("/donor/proof", (req,res) => {
	res.redirect("/donor/proofs");
});

router.post("/donor/donation/addPhotos/:donationId",
	middleware.ensureDonorLoggedIn,
	(req,res,next) => {
		donationPhotoUploader(req,res,(err) => {
			if (err) {
				req.flash("error", err.message || "Unable to upload photos.");
				return res.redirect("back");
			}
			next();
		});
	},
	async (req,res) => {
		try {
			const donation = await Donation.findOne({ _id: req.params.donationId, donor: req.user._id });
			if (!donation) {
				req.flash("error", "Donation not found.");
				return res.redirect("back");
			}
			if (!req.files || !req.files.length) {
				req.flash("warning", "Please select at least one image to upload.");
				return res.redirect("back");
			}
			const existing = donation.donationPhotos || [];
			const newPhotos = req.files.map(file => toDonationPhotoPath(file.path));
			donation.donationPhotos = existing.concat(newPhotos).slice(-10);
			await donation.save();
			req.flash("success", "Photos uploaded successfully.");
			res.redirect("/donor/proofs");
		} catch(err) {
			console.log(err);
			req.flash("error", "Unable to upload photos right now.");
			res.redirect("back");
		}
	}
);

router.get("/donor/donation/deleteRejected/:donationId", async (req,res) => {
	try
	{
		const donationId = req.params.donationId;
		await Donation.findByIdAndDelete(donationId);
		res.redirect("/donor/donations/pending");
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
});

router.get("/donor/profile", middleware.ensureDonorLoggedIn, (req,res) => {
	res.render("donor/profile", { title: "My Profile" });
});

router.put("/donor/profile", middleware.ensureDonorLoggedIn, async (req,res) => {
	try
	{
		const id = req.user._id;
		const updateObj = req.body.donor;	// updateObj: {firstName, lastName, gender, address, phone}
		await User.findByIdAndUpdate(id, updateObj);
		
		req.flash("success", "Profile updated successfully");
		res.redirect("/donor/profile");
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
	
});


module.exports = router;