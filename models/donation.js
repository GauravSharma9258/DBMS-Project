const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema({
	donor: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "users",
		required: true
	},
	agent: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "users",
	},
	foodType: {
		type: String,
		required: true
	},
	quantity: {
		type: String,
		required: true
	},
	cookingTime: {
		type: Date,
		required: true
	},
	address: {
		type: String,
		required: true
	},
	phone: {
		type: Number,
		required: true
	},
	latitude: {
		type: Number,
		min: -90,
		max: 90
	},
	longitude: {
		type: Number,
		min: -180,
		max: 180
	},
	expiryTime: {
		type: Date,
		required: true
	},
	donationPhotos: [String],
	donorToAdminMsg: String,
	adminToAgentMsg: String,
	collectionTime: {
		type: Date,
	},
	status: {
		type: String,
		enum: ["pending", "rejected", "assigned", "picked_up", "collected"],
		required: true
	},
	candidateAgents: [{
		agent: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "users"
		},
		status: {
			type: String,
			enum: ["pending", "accepted", "declined"],
			default: "pending"
		},
		distanceKm: Number,
		respondedAt: Date
	}],
	pickupConfirmedAt: Date,
	proofs: [String],
	proofNotes: String,
	autoAssignmentRunAt: Date,
	assignmentMethod: {
		type: String,
		enum: ["auto", "manual"],
		default: "auto"
	}
}, { timestamps: true });

const Donation = mongoose.model("donations", donationSchema);
module.exports = Donation;