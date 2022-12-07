require("dotenv").config();
const { createServer } = require("http");
const { ApolloServerPluginDrainHttpServer } = require("@apollo/server/plugin/drainHttpServer");
const { expressMiddleware } = require("@apollo/server/express4");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/lib/use/ws");
const app = require("express")();
const httpServer = createServer(app);
const cors = require("cors");

const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");

const todoResolver = require("./resolvers/todo_resolver");
const projectResolver = require("./resolvers/project_resolver");
const userResolver = require("./resolvers/user_resolver");
const queryResolver = require("./resolvers/query_resolver");
const mutationResolver = require("./resolvers/mutation_resolver");
const subscriptionResolver = require("./resolvers/subscription_resolver");

const { readAllText, print } = require("./utils/utils");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const bodyParser = require("body-parser");
const { listenToDbEvent } = require("./listeners/db_listeners");
const PORT = process.env.PORT || 3000;
const typeString = readAllText("/graphql/typeDef.graphql");
const typeDefs = typeString;

const resolvers = {
  Todo: todoResolver,
  Project: projectResolver,
  User: userResolver,
  Query: queryResolver,
  Mutation: mutationResolver,
  Subscription: subscriptionResolver,
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

const wsServer = new WebSocketServer({
  // This is the `httpServer` we created in a previous step.
  server: httpServer,
  // Pass a different path here if app.use
  // serves expressMiddleware at a different path
  path: "/graphql",
});

const serverCleanup = useServer({ schema }, wsServer);

const server = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        print("Server will start");
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});
server.start().then(() => {
  app.use("/graphql", cors(), bodyParser.json(), expressMiddleware(server, { context: (ctx) => ({ headers: ctx.req.headers }) }));
  httpServer.listen(PORT, () => {
    print("Listening at port " + PORT);
  });

  listenToDbEvent();
});