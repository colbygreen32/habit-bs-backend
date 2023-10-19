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
  const { type, user_id } = req.query;
  const mongo = await MongoClient.connect("mongodb+srv://colbyjgreen32:9IXrPtWMHvBdICx5@cluster0.f3he31n.mongodb.net");
  const HabitsCollection = mongo.db("HabitBS").collection("Habits");
  let habits = await HabitsCollection.find({ user_id: new ObjectId("652eed888b89b28bc1e8d0fc"), type }).toArray();
  res.send(habits);
});

app.get("/transactions", async (req, res) => {
  const { user_id } = req.query;

  const mongo = await MongoClient.connect("mongodb+srv://colbyjgreen32:9IXrPtWMHvBdICx5@cluster0.f3he31n.mongodb.net");
  const TransactionsCollection = mongo.db("HabitBS").collection("Transactions");
  const transactions = await TransactionsCollection.find({ user_id: new ObjectId(user_id) })
    .sort({ date: -1 })
    .toArray();

  return res.send(transactions);
});

app.get("/get-user", async (req, res) => {
  const { user_id } = req.query;
  const mongo = await MongoClient.connect("mongodb+srv://colbyjgreen32:9IXrPtWMHvBdICx5@cluster0.f3he31n.mongodb.net");
  const UsersCollection = mongo.db("HabitBS").collection("Users");
  const user = await UsersCollection.findOne({ _id: new ObjectId(user_id) });
  if (!user) {
    return res.status(400).send("Error");
  }
  return res.send(user);
});

app.post("/complete-habit", jsonParser, async (req, res) => {
  const { habitId } = req.body;
  const { user_id } = req.query;

  const habitObjectId = new ObjectId(habitId);
  const mongo = await MongoClient.connect("mongodb+srv://colbyjgreen32:9IXrPtWMHvBdICx5@cluster0.f3he31n.mongodb.net");
  const HabitsCollection = mongo.db("HabitBS").collection("Habits");
  const TransactionsCollection = mongo.db("HabitBS").collection("Transactions");
  const UsersCollection = mongo.db("HabitBS").collection("Users");

  const habit = await HabitsCollection.findOne({ _id: habitObjectId });

  await TransactionsCollection.insertOne({
    habit_id: habit._id,
    habit_name: habit.name,
    amount: habit.amount,
    credit: habit.type === "positive",
    user_id: new Object(user_id),
    date: new Date()
  });

  await UsersCollection.updateOne({ _id: new Object(user_id) }, { $inc: { balance: habit.type === "positive" ? habit.amount : habit.amount * -1 } });

  res.send("Success");
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
