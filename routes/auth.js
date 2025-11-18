const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const passport = require("passport");
const path = require("path");
const fs = require("fs");
const User = require("../models/user.js");
const middleware = require("../middleware/index.js");
const upload = require("../config/upload");

const donorUploads = upload.fields([
	{ name: "restaurantLicense", maxCount: 1 },
	{ name: "restaurantPhotos", maxCount: 5 }
]);

const cleanupUploadedFiles = (files) => {
	if (!files) return;
	Object.values(files).flat().forEach(file => {
		fs.unlink(file.path, () => {});
	});
};

const toPublicPath = (file) => file ? `/uploads/restaurants/${path.basename(file.path)}` : undefined;


router.get("/auth/signup", middleware.ensureNotLoggedIn, (req,res) => {
	res.render("auth/signup", { title: "User Signup", role: "donor" });
});

router.post("/auth/signup",
	middleware.ensureNotLoggedIn,
	(req, res, next) => {
		donorUploads(req, res, function (err) {
			if (err) {
				req.flash("error", err.message);
				return res.redirect("back");
			}
			next();
		});
	},
	async (req,res) => {
	
	let {
		firstName,
		lastName,
		email,
		password1,
		password2,
		role,
		phone,
		ownerName,
		restaurantName,
		restaurantAddress,
		restaurantPhone,
		licenseNumber,
		latitude,
		longitude
	} = req.body;

	const selectedRole = role || "donor";
	const normalizedRole = ["admin", "agent", "donor"].includes(selectedRole) ? selectedRole : "donor";

	let errors = [];
	
	if (!firstName || !lastName || !email || !password1 || !password2) {
		errors.push({ msg: "Please fill in all the fields" });
	}
	if (password1 != password2) {
		errors.push({ msg: "Passwords are not matching" });
	}
	if (password1.length < 4) {
		errors.push({ msg: "Password length should be atleast 4 characters" });
	}

	if (normalizedRole === "donor" || normalizedRole === "agent") {
		if (!ownerName || !restaurantName || !restaurantAddress) {
			errors.push({ msg: "Please provide all restaurant details" });
		}
		if (!phone || !restaurantPhone) {
			errors.push({ msg: "Please provide contact numbers" });
		}
		if (!licenseNumber) {
			errors.push({ msg: normalizedRole === "donor" ? "Restaurant license number is required" : "NGO registration/license number is required" });
		}
		if (!latitude || !longitude) {
			errors.push({ msg: "Please pin your organisation location on the map" });
		}
		if (!req.files || !req.files.restaurantLicense || !req.files.restaurantLicense.length) {
			errors.push({ msg: normalizedRole === "donor" ? "Please upload your restaurant license image" : "Please upload your NGO registration/license image" });
		}
	}

	if(errors.length > 0) {
		cleanupUploadedFiles(req.files);
		return res.render("auth/signup", {
			title: "User Signup",
			errors, firstName, lastName, email, password1, password2, role: normalizedRole,
			phone, ownerName, restaurantName, restaurantAddress, restaurantPhone,
			licenseNumber, latitude, longitude
		});
	}
	
	try
	{
		const user = await User.findOne({ email: email });
		if(user)
		{
			errors.push({msg: "This Email is already registered. Please try another email."});
			return res.render("auth/signup", {
				title: "User Signup",
				firstName, lastName, errors, email, password1, password2, role: normalizedRole,
				phone, ownerName, restaurantName, restaurantAddress, restaurantPhone,
				licenseNumber, latitude, longitude
			});
		}
		
		let latitudeNum, longitudeNum;
		if (normalizedRole === "donor" || normalizedRole === "agent") {
			latitudeNum = parseFloat(latitude);
			longitudeNum = parseFloat(longitude);
			if (Number.isNaN(latitudeNum) || Number.isNaN(longitudeNum)) {
				errors.push({ msg: "Invalid coordinates received. Please drop the pin again." });
				cleanupUploadedFiles(req.files);
				return res.render("auth/signup", {
					title: "User Signup",
					firstName, lastName, errors, email, password1, password2, role: normalizedRole,
					phone, ownerName, restaurantName, restaurantAddress, restaurantPhone,
					licenseNumber, latitude, longitude
				});
			}
		}

		const licenseImagePath = req.files && req.files.restaurantLicense && req.files.restaurantLicense[0]
			? toPublicPath(req.files.restaurantLicense[0])
			: undefined;
		const restaurantPhotos = req.files && req.files.restaurantPhotos
			? req.files.restaurantPhotos.map(file => toPublicPath(file))
			: [];

		const newUser = new User({
			firstName,
			lastName,
			email,
			password: password1,
			role: normalizedRole,
			phone,
			address: restaurantAddress,
			restaurantName,
			restaurantAddress,
			restaurantPhone,
			ownerName,
			licenseNumber,
			licenseImagePath,
			restaurantPhotos,
			latitude: latitudeNum,
			longitude: longitudeNum
		});
		const salt = bcrypt.genSaltSync(10);
		const hash = bcrypt.hashSync(newUser.password, salt);
		newUser.password = hash;
		await newUser.save();
		req.flash("success",
			normalizedRole === "donor"
				? "Thanks! Your restaurant application was submitted. We'll notify you once it's verified."
				: normalizedRole === "agent"
					? "Thanks! Your NGO application was submitted. We'll notify you once it's verified."
					: "You are successfully registered and can log in."
		);
		res.redirect("/auth/login");
	}
	catch(err)
	{
		cleanupUploadedFiles(req.files);
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
	
});

router.get("/auth/login", middleware.ensureNotLoggedIn, (req,res) => {
	res.render("auth/login", { title: "User login" });
});

router.post("/auth/login", middleware.ensureNotLoggedIn,
	passport.authenticate('local', {
		failureRedirect: "/auth/login",
		failureFlash: true,
		successFlash: true
	}), (req,res) => {
		res.redirect(req.session.returnTo || `/${req.user.role}/dashboard`);
	}
);

router.get("/auth/logout", (req,res) => {
	req.logout();
	req.flash("success", "Logged-out successfully")
	res.redirect("/");
});


module.exports = router;