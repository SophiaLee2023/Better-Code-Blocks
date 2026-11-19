package com.example;

import java.util.List;

@SuppressWarnings("unchecked")
public class Greeter implements Runnable {
    private static final int MAX = 3;
    private final List<String> names;

    public Greeter(List<String> names) { this.names = names; }

    @Override
    public void run() {
        for (int i = 0; i < MAX && i < names.size(); i++) {
            System.out.println("Hello, " + names.get(i) + '!');
        }
    }
}
