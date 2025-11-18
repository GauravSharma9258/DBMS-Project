const express = require("express");
const router = express.Router();
const middleware = require("../middleware/index.js");
const User = require("../models/user.js");
const Donation = require("../models/donation.js");


router.get("/admin/dashboard", middleware.ensureAdminLoggedIn, async (req,res) => {
	const numAdmins = await User.countDocuments({ role: "admin" });
	const numDonors = await User.countDocuments({ role: "donor" });
	const numAgents = await User.countDocuments({ role: "agent" });
	const numPendingDonations = await Donation.countDocuments({ status: "pending" });
	const numAssignedDonations = await Donation.countDocuments({ status: "assigned" });
	const numCollectedDonations = await Donation.countDocuments({ status: "collected" });
	res.render("admin/dashboard", {
		title: "Dashboard",
		numAdmins, numDonors, numAgents, numPendingDonations, numAssignedDonations, numCollectedDonations
	});
});

router.get("/admin/donations/pending", middleware.ensureAdminLoggedIn, async (req,res) => {
	try
	{
		const pendingDonations = await Donation.find({ status: { $in: ["pending", "assigned"] }}).populate("donor").populate("agent");
		res.render("admin/pendingDonations", { title: "Pending Donations", pendingDonations });
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
});

router.get("/admin/donations/previous", middleware.ensureAdminLoggedIn, async (req,res) => {
	try
	{
		const previousDonations = await Donation.find({ status: "collected" }).populate("donor");
		res.render("admin/previousDonations", { title: "Previous Donations", previousDonations });
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
});

router.get("/admin/donation/view/:donationId", middleware.ensureAdminLoggedIn, async (req,res) => {
	try
	{
		const donationId = req.params.donationId;
		const donation = await Donation.findById(donationId).populate("donor").populate("agent").populate("candidateAgents.agent");
		res.render("admin/donation", { title: "Donation details", donation });
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
});

router.get("/admin/donation/reject/:donationId", middleware.ensureAdminLoggedIn, async (req,res) => {
	try
	{
		const donationId = req.params.donationId;
		await Donation.findByIdAndUpdate(donationId, { status: "rejected" });
		req.flash("success", "Donation rejected successfully");
		res.redirect(`/admin/donation/view/${donationId}`);
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
});

router.get("/admin/agents", middleware.ensureAdminLoggedIn, async (req,res) => {
	try
	{
		const agents = await User.find({ role: "agent" });
		res.render("admin/agents", { title: "List of agents", agents });
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
});


router.get("/admin/profile", middleware.ensureAdminLoggedIn, (req,res) => {
	res.render("admin/profile", { title: "My profile" });
});

router.get("/admin/restaurants", middleware.ensureAdminLoggedIn, async (req,res) => {
	try {
		const restaurants = await User.find({ role: "donor" }).sort({ joinedTime: -1 });
		const stats = restaurants.reduce((acc, restaurant) => {
			if (restaurant.verificationStatus === "approved") acc.approved += 1;
			else if (restaurant.verificationStatus === "rejected") acc.rejected += 1;
			else acc.pending += 1;
			return acc;
		}, { pending: 0, approved: 0, rejected: 0 });
		res.render("admin/restaurants", { title: "Restaurant applications", restaurants, stats });
	} catch (err) {
		console.log(err);
		req.flash("error", "Unable to load restaurants. Please try again.");
		res.redirect("back");
	}
});

router.get("/admin/ngos", middleware.ensureAdminLoggedIn, async (req,res) => {
	try {
		const ngos = await User.find({ role: "agent" }).sort({ joinedTime: -1 });
		const stats = ngos.reduce((acc, ngo) => {
			if (ngo.verificationStatus === "approved") acc.approved += 1;
			else if (ngo.verificationStatus === "rejected") acc.rejected += 1;
			else acc.pending += 1;
			return acc;
		}, { pending: 0, approved: 0, rejected: 0 });
		res.render("admin/ngos", { title: "NGO applications", ngos, stats });
	} catch (err) {
		console.log(err);
		req.flash("error", "Unable to load NGOs. Please try again.");
		res.redirect("back");
	}
});

router.get("/admin/ngos/:ngoId", middleware.ensureAdminLoggedIn, async (req,res) => {
	try {
		const ngo = await User.findById(req.params.ngoId);
		if (!ngo || ngo.role !== "agent") {
			req.flash("error", "NGO not found.");
			return res.redirect("/admin/ngos");
		}
		res.render("admin/ngo", { title: "NGO review", ngo });
	} catch (err) {
		console.log(err);
		req.flash("error", "Unable to fetch NGO details.");
		res.redirect("back");
	}
});

router.post("/admin/ngos/:ngoId/verify", middleware.ensureAdminLoggedIn, async (req,res) => {
	try {
		const { status, notes } = req.body;
		if (!["approved", "rejected"].includes(status)) {
			req.flash("error", "Invalid verification status.");
			return res.redirect("back");
		}
		const ngo = await User.findById(req.params.ngoId);
		if (!ngo || ngo.role !== "agent") {
			req.flash("error", "NGO not found.");
			return res.redirect("/admin/ngos");
		}

		ngo.verificationStatus = status;
		ngo.verificationNotes = notes || "";
		await ngo.save();

		req.flash("success", `NGO ${status === "approved" ? "approved" : "rejected"} successfully.`);
		res.redirect(`/admin/ngos/${ngo._id}`);
	} catch (err) {
		console.log(err);
		req.flash("error", "Unable to update NGO verification status.");
		res.redirect("back");
	}
});

router.get("/admin/restaurants/:restaurantId", middleware.ensureAdminLoggedIn, async (req,res) => {
	try {
		const restaurant = await User.findById(req.params.restaurantId);
		if (!restaurant || restaurant.role !== "donor") {
			req.flash("error", "Restaurant not found.");
			return res.redirect("/admin/restaurants");
		}
		res.render("admin/restaurant", { title: "Restaurant review", restaurant });
	} catch (err) {
		console.log(err);
		req.flash("error", "Unable to fetch restaurant details.");
		res.redirect("back");
	}
});

router.post("/admin/restaurants/:restaurantId/verify", middleware.ensureAdminLoggedIn, async (req,res) => {
	try {
		const { status, notes } = req.body;
		if (!["approved", "rejected"].includes(status)) {
			req.flash("error", "Invalid verification status.");
			return res.redirect("back");
		}
		const restaurant = await User.findById(req.params.restaurantId);
		if (!restaurant || restaurant.role !== "donor") {
			req.flash("error", "Restaurant not found.");
			return res.redirect("/admin/restaurants");
		}

		restaurant.verificationStatus = status;
		restaurant.verificationNotes = notes || "";
		await restaurant.save();

		req.flash("success", `Restaurant ${status === "approved" ? "approved" : "rejected"} successfully.`);
		res.redirect(`/admin/restaurants/${restaurant._id}`);
	} catch (err) {
		console.log(err);
		req.flash("error", "Unable to update verification status.");
		res.redirect("back");
	}
});

router.put("/admin/profile", middleware.ensureAdminLoggedIn, async (req,res) => {
	try
	{
		const id = req.user._id;
		const updateObj = req.body.admin;	// updateObj: {firstName, lastName, gender, address, phone}
		await User.findByIdAndUpdate(id, updateObj);
		
		req.flash("success", "Profile updated successfully");
		res.redirect("/admin/profile");
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
	
});


module.exports = router;