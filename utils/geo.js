function toRad(value) {
	return value * Math.PI / 180;
}

function haversineDistanceKm(a, b) {
	if (!a || !b || typeof a.lat !== "number" || typeof a.lng !== "number" || typeof b.lat !== "number" || typeof b.lng !== "number") {
		return null;
	}
	const R = 6371;
	const dLat = toRad(b.lat - a.lat);
	const dLon = toRad(b.lng - a.lng);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);

	const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
	const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
	return R * c;
}

module.exports = { haversineDistanceKm };

