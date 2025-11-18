const express = require("express");
const path = require("path");
const router = express.Router();
const middleware = require("../middleware/index.js");
const User = require("../models/user.js");
const Donation = require("../models/donation.js");
const upload = require("../config/upload");

router.get("/agent/dashboard", middleware.ensureAgentLoggedIn, async (req,res) => {
	const agentId = req.user._id;
	const numAssignedDonations = await Donation.countDocuments({ agent: agentId, status: "assigned" });
	const numCollectedDonations = await Donation.countDocuments({ agent: agentId, status: "collected" });
	res.render("agent/dashboard", {
		title: "Dashboard",
		numAssignedDonations, numCollectedDonations
	});
});

router.get("/agent/verification", middleware.ensureAgentLoggedIn, (req,res) => {
	res.render("agent/verification", { title: "Verification status" });
});

router.get("/agent/collections/pending", middleware.ensureAgentLoggedIn, middleware.ensureVerifiedAgent, async (req,res) => {
	try
	{
		const invites = await Donation.find({
			status: "pending",
			candidateAgents: { $elemMatch: { agent: req.user._id, status: "pending" } }
		}).populate("donor");

		const pendingCollections = await Donation.find({ agent: req.user._id, status: "assigned" }).populate("donor");
		res.render("agent/pendingCollections", { title: "Pending Collections", invites, pendingCollections });
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
});

router.get("/agent/proofs", middleware.ensureAgentLoggedIn, async (req,res) => {
	try {
		const collectedDonations = await Donation.find({ agent: req.user._id, status: "collected" })
			.populate("donor")
			.sort({ collectionTime: -1 });
		const pendingProofs = collectedDonations.filter(donation => !donation.proofs || !donation.proofs.length);
		const submittedProofs = collectedDonations.filter(donation => donation.proofs && donation.proofs.length);
		res.render("agent/proofs", {
			title: "Photo proofs",
			pendingProofs,
			submittedProofs
		});
	} catch(err) {
		console.log(err);
		req.flash("error", "Unable to load proofs right now.");
		res.redirect("back");
	}
});

router.get("/agent/proof", (req,res) => {
	res.redirect("/agent/proofs");
});

router.post("/agent/collections/respond/:donationId", middleware.ensureAgentLoggedIn, middleware.ensureVerifiedAgent, async (req,res) => {
	try
	{
		const { action } = req.body;
		const donation = await Donation.findById(req.params.donationId);
		if (!donation) {
			req.flash("error", "Donation not found.");
			return res.redirect("back");
		}
		const candidate = donation.candidateAgents.find(entry => entry.agent && entry.agent.equals(req.user._id));
		if (!candidate || candidate.status !== "pending") {
			req.flash("warning", "This donation is no longer available.");
			return res.redirect("back");
		}

		if (action === "accept") {
			if (donation.status !== "pending") {
				req.flash("warning", "Another agent already accepted this donation.");
				return res.redirect("back");
			}
			donation.agent = req.user._id;
			donation.status = "assigned";
			candidate.status = "accepted";
			candidate.respondedAt = new Date();
			await donation.save();
			req.flash("success", "Donation accepted. Please coordinate with the donor.");
		} else {
			candidate.status = "declined";
			candidate.respondedAt = new Date();
			await donation.save();
			req.flash("info", "You declined this donation.");
		}
		res.redirect("/agent/collections/pending");
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Unable to update donation.");
		res.redirect("back");
	}
});

router.get("/agent/collections/previous", middleware.ensureAgentLoggedIn, async (req,res) => {
	try
	{
		const previousCollections = await Donation.find({ agent: req.user._id, status: "collected" }).populate("donor");
		res.render("agent/previousCollections", { title: "Previous Collections", previousCollections });
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
});

router.get("/agent/collection/view/:collectionId", middleware.ensureAgentLoggedIn, async (req,res) => {
	try
	{
		const collectionId = req.params.collectionId;
		const collection = await Donation.findById(collectionId).populate("donor");
		if (!collection || !collection.agent || !collection.agent.equals(req.user._id)) {
			req.flash("warning", "You are not assigned to this donation.");
			return res.redirect("/agent/collections/pending");
		}
		res.render("agent/collection", { title: "Collection details", collection });
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
});

router.get("/agent/collection/collect/:collectionId", middleware.ensureAgentLoggedIn, middleware.ensureVerifiedAgent, async (req,res) => {
	try
	{
		const collectionId = req.params.collectionId;
		const donation = await Donation.findById(collectionId);
		if (!donation || !donation.agent || !donation.agent.equals(req.user._id)) {
			req.flash("warning", "You are not assigned to this donation.");
			return res.redirect("/agent/collections/pending");
		}
		if (!["assigned", "picked_up"].includes(donation.status)) {
			req.flash("warning", "This donation cannot be collected right now.");
			return res.redirect("/agent/collections/pending");
		}
		donation.status = "collected";
		donation.collectionTime = Date.now();
		await donation.save();
		req.flash("success", "Donation collected successfully. Please remember to upload proof photos within the next few hours.");
		res.redirect(`/agent/collection/view/${collectionId}#proof-section`);
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
});



router.get("/agent/profile", middleware.ensureAgentLoggedIn, (req,res) => {
	res.render("agent/profile", { title: "My Profile" });
});

router.put("/agent/profile", middleware.ensureAgentLoggedIn, async (req,res) => {
	try
	{
		const id = req.user._id;
		const updateObj = req.body.agent;	// updateObj: {firstName, lastName, gender, address, phone}
		await User.findByIdAndUpdate(id, updateObj);
		
		req.flash("success", "Profile updated successfully");
		res.redirect("/agent/profile");
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
	
});

router.get("/agent/track", middleware.ensureAgentLoggedIn, async (req,res) => {
	try {
		const donations = await Donation.find({ agent: req.user._id, status: { $in: ["assigned", "picked_up", "collected"] } })
			.populate("donor")
			.sort({ createdAt: -1 });
		res.render("agent/track", { title: "Live tracking", donations });
	} catch(err) {
		console.log(err);
		req.flash("error", "Unable to load live tracking.");
		res.redirect("back");
	}
});

router.post("/agent/collections/clear", middleware.ensureAgentLoggedIn, async (req,res) => {
	try {
		await Donation.deleteMany({ agent: req.user._id, status: "collected" });
		req.flash("success", "Previous collection records cleared.");
		res.redirect("/agent/collections/previous");
	} catch(err) {
		console.log(err);
		req.flash("error", "Unable to clear records right now.");
		res.redirect("back");
	}
});

const proofUploader = upload.array("proofPhotos", 4);

const toPublicPath = (filePath) => `/uploads/restaurants/${path.basename(filePath)}`;

router.post("/agent/collection/uploadProof/:collectionId",
	middleware.ensureAgentLoggedIn,
	middleware.ensureVerifiedAgent,
	(req,res,next) => {
		proofUploader(req,res,(err) => {
			if (err) {
				req.flash("error", err.message || "Unable to upload images.");
				return res.redirect("back");
			}
			next();
		});
	},
	async (req,res) => {
		try {
			const donation = await Donation.findById(req.params.collectionId);
			if (!donation || !donation.agent || !donation.agent.equals(req.user._id)) {
				req.flash("error", "Donation not found.");
				return res.redirect("back");
			}
			if (donation.status === "rejected" || donation.status === "pending") {
				req.flash("warning", "This donation is not ready for proof submission.");
				return res.redirect("back");
			}
			const existingProofs = donation.proofs || [];
			let combined = existingProofs;
			if (req.files && req.files.length) {
				const newProofs = req.files.map(file => toPublicPath(file.path));
				combined = existingProofs.concat(newProofs).slice(-10);
				donation.proofs = combined;
			}
			if (req.body.proofNotes) {
				donation.proofNotes = req.body.proofNotes;
			}
			await donation.save();
			req.flash("success", "Proof photos uploaded successfully.");
			res.redirect(`/agent/collection/view/${donation._id}`);
		} catch(err) {
			console.log(err);
			req.flash("error", "Unable to upload proof right now.");
			res.redirect("back");
		}
	}
);


module.exports = router;