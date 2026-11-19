#include <stdio.h>
#define SIZE 8

typedef struct { int x; int y; } point_t;

int main(void) {
    point_t pts[SIZE] = {0};
    /* fill */
    for (int i = 0; i < SIZE; i++) {
        pts[i].x = i * 2;
    }
    printf("%d\n", pts[3].x);
    return 0;
}
