const express = require("express");
const path = require("path");
const app = express();
const passport = require("passport");
const flash = require("connect-flash");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const expressLayouts = require("express-ejs-layouts");
const methodOverride = require("method-override");
const homeRoutes = require("./routes/home.js");
const authRoutes = require("./routes/auth.js");
const adminRoutes = require("./routes/admin.js");
const donorRoutes = require("./routes/donor.js");
const agentRoutes = require("./routes/agent.js");
const apiRoutes = require("./routes/api.js");
require("dotenv").config();
require("./config/dbConnection.js")();
require("./config/passport.js")(passport);



app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
// Required when running behind a proxy (e.g., Vercel) so secure cookies work
if (process.env.VERCEL || process.env.NODE_ENV === "production") {
	app.set("trust proxy", 1);
}
app.use(expressLayouts);
app.use("/assets", express.static(__dirname + "/assets"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Sessions: use Mongo-backed store in production (MemoryStore only for local dev)
app.use(session({
	secret: process.env.SESSION_SECRET || "secret",
	resave: false,
	saveUninitialized: false,
	store: process.env.MONGO_URI ? MongoStore.create({
		mongoUrl: process.env.MONGO_URI,
		collectionName: "sessions"
	}) : undefined,
	cookie: {
		secure: process.env.NODE_ENV === "production",
		sameSite: process.env.NODE_ENV === "production" ? "lax" : "lax",
		maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
	}
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(methodOverride("_method"));
app.use((req, res, next) => {
	res.locals.currentUser = req.user;
	res.locals.error = req.flash("error");
	res.locals.success = req.flash("success");
	res.locals.warning = req.flash("warning");
	next();
});



// Routes
app.use(homeRoutes);
app.use(authRoutes);
app.use(donorRoutes);
app.use(adminRoutes);
app.use(agentRoutes);
app.use(apiRoutes);
app.use((req,res) => {
	res.status(404).render("404page", { title: "Page not found" });
});


const port = process.env.PORT || 5000;
if (process.env.VERCEL) {
	// Export the app for Vercel serverless environment
	module.exports = app;
} else {
	app.listen(port, () => console.log(`Server is running at http://localhost:${port}`));
}
