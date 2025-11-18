const Donation = require("../models/donation");
const User = require("../models/user");
const { haversineDistanceKm } = require("../utils/geo");

async function autoAssignAgents(donationId) {
	const donation = await Donation.findById(donationId).populate("donor");
	if (!donation) return;

	let lat = donation.latitude;
	let lng = donation.longitude;

	if (typeof lat !== "number" || typeof lng !== "number") {
		const donor = donation.donor || await User.findById(donation.donor);
		lat = donor?.latitude;
		lng = donor?.longitude;
		if (typeof lat !== "number" || typeof lng !== "number") {
			return;
		}
		await Donation.findByIdAndUpdate(donationId, { latitude: lat, longitude: lng });
	}

	const eligibleAgents = await User.find({
		role: "agent",
		verificationStatus: "approved",
		latitude: { $ne: null },
		longitude: { $ne: null }
	});

	if (!eligibleAgents.length) return;

	const ranked = eligibleAgents
		.map(agent => {
			const distance = haversineDistanceKm({ lat, lng }, { lat: agent.latitude, lng: agent.longitude });
			return {
				agent,
				distance: typeof distance === "number" ? distance : Infinity
			};
		})
		.filter(entry => Number.isFinite(entry.distance))
		.sort((a, b) => a.distance - b.distance)
		.slice(0, 3);

	if (!ranked.length) return;

	const candidateAgents = ranked.map(entry => ({
		agent: entry.agent._id,
		distanceKm: Number(entry.distance.toFixed(2)),
		status: "pending"
	}));

	await Donation.findByIdAndUpdate(donationId, {
		candidateAgents,
		autoAssignmentRunAt: new Date(),
		assignmentMethod: "auto"
	});
}

module.exports = { autoAssignAgents };

