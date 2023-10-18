import express from "express";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import bodyParser from "body-parser";

var jsonParser = bodyParser.json();
dotenv.config();
const app = express();
app.use(cors());
const port = 8080;

app.get("/test", async (req, res) => {
  res.send("Test Success");
});

app.get("/get-habits", async (req, res) => {
  const { type } = req.query;
  const mongo = await MongoClient.connect("mongodb+srv://colbyjgreen32:9IXrPtWMHvBdICx5@cluster0.f3he31n.mongodb.net");
  const HabitsCollection = mongo.db("HabitBS").collection("Habits");
  let habits = await HabitsCollection.find({ type }).toArray();
  res.send(habits);
});

app.get("/transactions", async (req, res) => {
  const ipIndex = req.rawHeaders.indexOf("X-Forwarded-For");
  const userIp = req.rawHeaders[ipIndex + 1];

  const mongo = await MongoClient.connect("mongodb+srv://colbyjgreen32:9IXrPtWMHvBdICx5@cluster0.f3he31n.mongodb.net");
  const UsersCollection = mongo.db("HabitBS").collection("Users");
  const TransactionsCollection = mongo.db("HabitBS").collection("Transactions");

  const user = await UsersCollection.findOne({ ip: userIp });
  const transactions = await TransactionsCollection.find({ user_id: user._id }).sort({ date: -1 }).toArray();

  return res.send(transactions);
});

app.get("/get-user", async (req, res) => {
  const mongo = await MongoClient.connect("mongodb+srv://colbyjgreen32:9IXrPtWMHvBdICx5@cluster0.f3he31n.mongodb.net");
  const UsersCollection = mongo.db("HabitBS").collection("Users");
  const ipIndex = req.rawHeaders.indexOf("X-Forwarded-For");
  const userIp = req.rawHeaders[ipIndex + 1];
  const user = await UsersCollection.findOne({ ip: userIp });
  if (!user) {
    return res.status(400).send("Error");
  }
  return res.send(user);
});

app.post("/complete-habit", jsonParser, async (req, res) => {
  const ipIndex = req.rawHeaders.indexOf("X-Forwarded-For");
  const userIp = req.rawHeaders[ipIndex + 1];
  const { habitId } = req.body;

  const habitObjectId = new ObjectId(habitId);
  const mongo = await MongoClient.connect("mongodb+srv://colbyjgreen32:9IXrPtWMHvBdICx5@cluster0.f3he31n.mongodb.net");
  const HabitsCollection = mongo.db("HabitBS").collection("Habits");
  const TransactionsCollection = mongo.db("HabitBS").collection("Transactions");
  const UsersCollection = mongo.db("HabitBS").collection("Users");

  const user = await UsersCollection.findOne({ ip: userIp });
  if (!user) {
    res.status(400).send("Error");
  }

  const habit = await HabitsCollection.findOne({ _id: habitObjectId });

  await TransactionsCollection.insertOne({
    habit_id: habit._id,
    habit_name: habit.name,
    amount: habit.amount,
    credit: habit.type === "positive",
    user_id: user._id,
    date: new Date()
  });

  await UsersCollection.updateOne({ _id: user._id }, { $inc: { balance: habit.type === "positive" ? habit.amount : habit.amount * -1 } });

  res.send("Success");
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
