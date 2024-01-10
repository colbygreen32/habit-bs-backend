import express from "express";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import bodyParser from "body-parser";
import util from "@mdi/util";

var jsonParser = bodyParser.json();
dotenv.config();
const app = express();
app.use(cors());
const port = 8080;

app.get("/test", async (req, res) => {
  return res.send("Test Success");
});

app.get("/icons", async (req, res) => {
  let icons = util.getMeta(true);
  icons = icons.filter((icon) => !icon.deprecated);
  // const categories = new Set();

  // for (const icon of icons) {
  //   for (const tag of icon.tags) {
  //     categories.add(tag);
  //   }
  // }
  return res.send(icons);
});

app.get("/get-habits", async (req, res) => {
  const mongo = await MongoClient.connect("mongodb+srv://colbyjgreen32:9IXrPtWMHvBdICx5@cluster0.f3he31n.mongodb.net");
  try {
    const { type, user_id, query_depth = "filtered" } = req.query;

    const HabitsCollection = mongo.db("HabitBS").collection("Habits");

    let habits = await HabitsCollection.find({ user_id: new ObjectId(user_id), type }).toArray();

    let filteredHabits = [];
    if (query_depth == "filtered") {
      const TransactionsCollection = mongo.db("HabitBS").collection("Transactions");
      const date = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
      const localDate = new Date(date);
      const today = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate());
      for (const habit of habits) {
        if (!habit.redemptions_per_day) {
          filteredHabits.push(habit);
          continue;
        }
        const transactions = await TransactionsCollection.find({ habit_id: habit._id, date: { $gt: today } }).toArray();
        if (transactions.length < habit.redemptions_per_day) {
          filteredHabits.push(habit);
        }
      }
    }

    return res.send(query_depth === "filtered" ? filteredHabits : habits);
  } catch (error) {
    return res.status(400).send(error.message);
  } finally {
    await mongo.close();
  }
});

app.get("/transactions", async (req, res) => {
  const mongo = await MongoClient.connect("mongodb+srv://colbyjgreen32:9IXrPtWMHvBdICx5@cluster0.f3he31n.mongodb.net");
  try {
    const { user_id } = req.query;
    const TransactionsCollection = mongo.db("HabitBS").collection("Transactions");
    const transactions = await TransactionsCollection.find({ user_id: new ObjectId(user_id) })
      .sort({ date: -1 })
      .toArray();

    return res.send(transactions);
  } catch (error) {
    return res.status(400).send(error.message);
  } finally {
    await mongo.close();
  }
});

app.get("/get-user", async (req, res) => {
  const mongo = await MongoClient.connect("mongodb+srv://colbyjgreen32:9IXrPtWMHvBdICx5@cluster0.f3he31n.mongodb.net");
  try {
    const { user_id } = req.query;
    const UsersCollection = mongo.db("HabitBS").collection("Users");
    const user = await UsersCollection.findOne({ _id: new ObjectId(user_id) });
    if (!user) {
      return res.status(400).send("Error");
    }
    return res.send(user);
  } catch (error) {
    return res.status(400).send(error.message);
  } finally {
    await mongo.close();
  }
});

app.post("/create-habit", jsonParser, async (req, res) => {
  const mongo = await MongoClient.connect("mongodb+srv://colbyjgreen32:9IXrPtWMHvBdICx5@cluster0.f3he31n.mongodb.net");
  try {
    const { type, name, amount, icon } = req.body;
    const { user_id } = req.query;

    const HabitsCollection = mongo.db("HabitBS").collection("Habits");

    await HabitsCollection.insertOne({
      type,
      name,
      amount,
      icon,
      user_id: new ObjectId(user_id)
    });

    return res.send("Success");
  } catch (error) {
    return res.status(400).send(error.message);
  }
});

app.post("/complete-habit", jsonParser, async (req, res) => {
  const ip = req.headers["true-client-ip"];

  // idk what this ip is from but its fuqing with my shit so ignore all request from it
  if (ip === "139.178.131.21" || ip === "139.178.130.74") {
    console.log(ip, "on that bullshit again");
    return res.send("Nah bruh");
  }
  const mongo = await MongoClient.connect("mongodb+srv://colbyjgreen32:9IXrPtWMHvBdICx5@cluster0.f3he31n.mongodb.net");
  try {
    const { habitId, hours } = req.body;
    const { user_id } = req.query;

    const habitObjectId = new ObjectId(habitId);
    const HabitsCollection = mongo.db("HabitBS").collection("Habits");
    const TransactionsCollection = mongo.db("HabitBS").collection("Transactions");
    const UsersCollection = mongo.db("HabitBS").collection("Users");

    const habit = await HabitsCollection.findOne({ _id: habitObjectId });

    const user = await UsersCollection.findOne({ _id: new ObjectId(user_id) });
    if (!user) throw new Error("No user found");

    console.log("complete-habit", user.user_name, habit.name, ip);

    let amount = habit.type === "positive" ? habit.amount : habit.amount * -1;
    if (hours) {
      amount = amount * hours;
    }
    const newBalance = user.balance + amount;

    await TransactionsCollection.insertOne({
      hours,
      habit_id: habit._id,
      habit_name: habit.name,
      amount: amount,
      icon: habit.icon,
      credit: habit.type === "positive",
      user_id: new ObjectId(user_id),
      date: new Date(),
      type: habit.type,
      balance_after_transaction: newBalance,
      balance_before_transaction: user.balance
    });

    await UsersCollection.updateOne({ _id: new ObjectId(user_id) }, { $set: { balance: newBalance } });

    return res.send("Success");
  } catch (error) {
    return res.status(400).send(error.message);
  } finally {
    await mongo.close();
  }
});

app.post("/reset-transactions", jsonParser, async (req, res) => {
  const mongo = await MongoClient.connect("mongodb+srv://colbyjgreen32:9IXrPtWMHvBdICx5@cluster0.f3he31n.mongodb.net");
  try {
    const { user_id } = req.query;

    const TransactionsCollection = mongo.db("HabitBS").collection("Transactions");
    const UsersCollection = mongo.db("HabitBS").collection("Users");

    await TransactionsCollection.deleteMany({ user_id: new ObjectId(user_id) });

    const user = await UsersCollection.findOne({ _id: new ObjectId(user_id) });
    if (!user) throw new Error("No user found");

    await UsersCollection.updateOne({ _id: new ObjectId(user_id) }, { $set: { balance: 0 } });

    return res.send("Success");
  } catch (error) {
    return res.status(400).send(error.message);
  } finally {
    await mongo.close();
  }
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
