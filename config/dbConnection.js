const mongoose = require("mongoose");

const connectDB = async() => {
	try
	{
		const db = process.env.MONGO_URI;
		
		if (!db || db === "yourmongouri" || db.trim() === "") {
			console.log("\n⚠️  WARNING: MongoDB connection string not configured!");
			console.log("Please set MONGO_URI in your .env file with a valid MongoDB connection string.");
			console.log("Example: mongodb://localhost:27017/foodaid");
			console.log("Or use MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/foodaid\n");
			process.exit(1);
		}
		
		await mongoose.connect(db);
		console.log("✅ MongoDB connected...");
	}
	catch(err)
	{
		console.log("\n❌ MongoDB connection error:");
		console.log(err.message);
		console.log("\nPlease check your MONGO_URI in the .env file.\n");
		process.exit(1);
	}
}

module.exports = connectDB;