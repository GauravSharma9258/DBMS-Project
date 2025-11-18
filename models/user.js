const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
	firstName: {
		type: String,
		required: true
	},
	lastName: {
		type: String,
		required: true
	},
	email: {
		type: String,
		required: true
	},
	password: {
		type: String,
		required: true
	},
	gender: {
		type: String,
		enum: ["male", "female"]
	},
	address: String,
	phone: String,
	restaurantName: String,
	restaurantAddress: String,
	restaurantPhone: String,
	ownerName: String,
	licenseNumber: String,
	licenseImagePath: String,
	restaurantPhotos: [String],
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
	verificationStatus: {
		type: String,
		enum: ["pending", "approved", "rejected", "not_required"],
		default: function () {
			return (this.role === "donor" || this.role === "agent") ? "pending" : "not_required";
		}
	},
	verificationNotes: String,
	joinedTime: {
		type: Date,
		default: Date.now
	},
	role: {
		type: String,
		enum: ["admin", "donor", "agent"],
		required: true
	}
});

const User = mongoose.model("users", userSchema);
module.exports = User;