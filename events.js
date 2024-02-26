import { Router } from "express";
import { MongoClient, ObjectId } from "mongodb";

const events = Router();

events.get("/", async (req, res) => {
  const mongo = await MongoClient.connect("mongodb+srv://colbyjgreen32:9IXrPtWMHvBdICx5@cluster0.f3he31n.mongodb.net");
  try {
    const { user_id } = req.query;

    const EventsCollection = mongo.db("HabitBS").collection("Events");

    const events = await EventsCollection.find({ user_id: new ObjectId(user_id) }).toArray();

    return res.send(events);
  } catch (error) {
    return res.status(400).send(error.message);
  } finally {
    await mongo.close();
  }
});

export default events;
